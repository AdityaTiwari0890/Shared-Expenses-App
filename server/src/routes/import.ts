import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import Papa from 'papaparse';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../lib/auth.js';
import { getResolvedUser } from '../lib/requestUser.js';
import {
  detectAnomalies,
  CSVRow,
} from '../services/anomalyDetectionService.js';
import { importValidRows } from '../services/importService.js';

const router = Router();

router.use(authMiddleware);

// Upload and analyze CSV
router.post('/:groupId/preview', async (req: AuthRequest, res: Response) => {
  try {
    const user = await getResolvedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { csv_content } = z.object({
      csv_content: z.string()
    }).parse(req.body);

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Parse CSV
    const results = Papa.parse<CSVRow>(csv_content, {
      header: true,
      skipEmptyLines: true
    });

    if (!results.data || results.data.length === 0) {
      res.status(400).json({ error: 'No data found in CSV' });
      return;
    }

    // Detect anomalies
    const anomalyResults = await detectAnomalies(results.data, group.id);

    // Store import log with anomalies (pending approval)
    const importLog = await prisma.importLog.create({
      data: {
        user_id: user.id,
        group_id: group.id,
        total_rows: results.data.length,
        valid_rows: anomalyResults.validRows.length,
        rejected_rows: anomalyResults.rejectedRows.length,
        report_json: {
          summary: {
            total: results.data.length,
            valid: anomalyResults.validRows.length,
            rejected: anomalyResults.rejectedRows.length,
            anomalies: anomalyResults.anomalies.length
          },
          valid_rows: anomalyResults.validRows,
          rejected_rows: anomalyResults.rejectedRows
        } as unknown as Prisma.InputJsonValue,
        anomalies: {
          create: anomalyResults.anomalies.map((anomaly: any) => ({
            row_number: anomaly.rowIndex,
            anomaly_type: anomaly.type,
            severity: anomaly.severity,
            description: anomaly.description,
            raw_data: JSON.parse(JSON.stringify(anomaly.row)),
            action_taken: anomaly.suggestedAction,
            requires_approval: anomaly.requiresApproval
          }))
        }
      },
      include: { anomalies: true }
    });

    const report = importLog.report_json as any;
    const anomaliesList = report?.anomalies || [];

    res.json({
      success: true,
      importLogId: importLog.id,
      summary: {
        total_rows: results.data.length,
        valid_rows: anomalyResults.validRows.length,
        rejected_rows: anomalyResults.rejectedRows.length,
        critical_anomalies: anomalyResults.anomalies.filter((a: any) => a.severity === 'CRITICAL').length,
        high_anomalies: anomalyResults.anomalies.filter((a: any) => a.severity === 'HIGH').length
      },
      anomalies: anomaliesList.map((a: any) => ({
        id: a.id,
        rowIndex: a.row_number,
        type: a.anomaly_type,
        severity: a.severity,
        description: a.description,
        suggestedAction: a.action_taken,
        requiresApproval: a.requires_approval
      }))
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Import preview error:', error);
      res.status(500).json({ error: 'Failed to preview import' });
    }
  }
});

// Approve/reject anomalies and finalize import
router.post('/:groupId/finalize/:importLogId', async (req: AuthRequest, res: Response) => {
  try {
    const user = await getResolvedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { approvals } = z.object({
      approvals: z.record(z.boolean()).optional().default({})
    }).parse(req.body);

    const importLog = await prisma.importLog.findUnique({
      where: { id: req.params.importLogId },
      include: { anomalies: true, group: { include: { members: true } } }
    });

    if (!importLog) {
      res.status(404).json({ error: 'Import log not found' });
      return;
    }

    if (importLog.group_id !== req.params.groupId) {
      res.status(400).json({ error: 'Import does not belong to this group' });
      return;
    }

    if (importLog.user_id !== user.id) {
      res.status(403).json({ error: 'Can only approve own imports' });
      return;
    }

    const reportJson = importLog.report_json as {
      summary?: Record<string, number>;
      valid_rows?: CSVRow[];
      finalized?: boolean;
    };

    if (reportJson.finalized) {
      res.status(400).json({ error: 'This import has already been completed' });
      return;
    }

    const validRows = reportJson.valid_rows ?? [];
    if (validRows.length === 0) {
      res.status(400).json({ error: 'No valid rows to import. Fix CSV errors and upload again.' });
      return;
    }

    // Update anomaly approvals using real database IDs
    for (const [anomalyId, approved] of Object.entries(approvals)) {
      const anomaly = importLog.anomalies.find((a) => a.id === anomalyId);
      if (!anomaly) continue;

      await prisma.importAnomaly.update({
        where: { id: anomalyId },
        data: {
          approved_at: approved ? new Date() : null,
          approved_by_id: approved ? user.id : null
        }
      });
    }

    const result = await importValidRows(importLog.group_id, validRows, user.id);

    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        report_json: {
          ...reportJson,
          finalized: true,
          imported_count: result.imported,
          skipped_count: result.skipped,
          errors: result.errors
        } as unknown as Prisma.InputJsonValue
      }
    });

    res.json({
      success: true,
      message: `Successfully imported ${result.imported} expense(s)`,
      importLogId: importLog.id,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Finalize import error:', error);
      res.status(500).json({ error: 'Failed to finalize import' });
    }
  }
});

// Get import history
router.get('/:groupId/history', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const imports = await prisma.importLog.findMany({
      where: { group_id: group.id },
      include: {
        user: true,
        anomalies: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ imports });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

export default router;
