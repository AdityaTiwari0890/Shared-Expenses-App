import { prisma } from '../index.js';

export interface CSVRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  validRows: CSVRow[];
  rejectedRows: { row: CSVRow; reason: string }[];
}

export interface Anomaly {
  rowIndex: number;
  row: CSVRow;
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  suggestedAction: string;
  requiresApproval: boolean;
}

export type AnomalyType =
  | 'DUPLICATE_EXPENSE'
  | 'MISSING_PAYER'
  | 'INVALID_DATE_FORMAT'
  | 'MISSING_CURRENCY'
  | 'NEGATIVE_AMOUNT'
  | 'INVALID_PERCENTAGE_SUM'
  | 'UNKNOWN_MEMBER'
  | 'POST_LEAVE_EXPENSE'
  | 'NAME_INCONSISTENCY'
  | 'SETTLEMENT_AS_EXPENSE'
  | 'CURRENCY_MISMATCH'
  | 'ZERO_AMOUNT'
  | 'WHITESPACE_ERROR'
  | 'MISSING_FIELD';

export async function detectAnomalies(
  rows: CSVRow[],
  groupId: string
): Promise<AnomalyDetectionResult> {
  const anomalies: Anomaly[] = [];
  const validRows: CSVRow[] = [];
  const rejectedRows: { row: CSVRow; reason: string }[] = [];

  // Get group context
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } }
  });

  if (!group) throw new Error('Group not found');

  // Track seen expenses for duplicate detection
  const seenExpenses = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowAnomalies: Anomaly[] = [];

    // 1. Check for missing critical fields
    if (!row.date || !row.description || !row.amount) {
      rowAnomalies.push({
        rowIndex: i + 2, // +2 for header and 0-indexing
        row,
        type: 'MISSING_FIELD',
        severity: 'CRITICAL',
        description: `Missing required field(s): ${!row.date ? 'date' : ''} ${!row.description ? 'description' : ''} ${!row.amount ? 'amount' : ''}`,
        suggestedAction: 'SKIP_ROW',
        requiresApproval: true
      });
      rejectedRows.push({ row, reason: 'Missing critical fields' });
      continue;
    }

    // 2. Check date format
    const parsedDate = parseDate(row.date);
    if (!parsedDate) {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'INVALID_DATE_FORMAT',
        severity: 'MEDIUM',
        description: `Invalid date format: "${row.date}"`,
        suggestedAction: 'REQUIRE_USER_INPUT',
        requiresApproval: true
      });
    }

    // 3. Check for missing payer
    if (!row.paid_by || row.paid_by.trim() === '') {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'MISSING_PAYER',
        severity: 'HIGH',
        description: 'Payer field is empty',
        suggestedAction: 'REQUIRE_USER_INPUT',
        requiresApproval: true
      });
    }

    // 4. Check for missing currency
    if (!row.currency || row.currency.trim() === '') {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'MISSING_CURRENCY',
        severity: 'MEDIUM',
        description: 'Currency not specified, will default to INR',
        suggestedAction: 'DEFAULT_TO_INR',
        requiresApproval: false
      });
    }

    // 5. Check amount validity
    const amount = parseFloat(row.amount.replace(/,/g, ''));
    if (isNaN(amount)) {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'INVALID_PERCENTAGE_SUM', // Generic numeric error
        severity: 'HIGH',
        description: `Invalid amount: "${row.amount}"`,
        suggestedAction: 'SKIP_ROW',
        requiresApproval: true
      });
    } else if (amount === 0) {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'ZERO_AMOUNT',
        severity: 'MEDIUM',
        description: 'Amount is zero',
        suggestedAction: 'SKIP_ROW',
        requiresApproval: true
      });
    } else if (amount < 0) {
      // Negative amounts are refunds - allow but flag
      if (!row.notes || !row.notes.toLowerCase().includes('refund')) {
        rowAnomalies.push({
          rowIndex: i + 2,
          row,
          type: 'NEGATIVE_AMOUNT',
          severity: 'LOW',
          description: `Negative amount (₹${amount}) - treating as refund`,
          suggestedAction: 'IMPORT_AS_REFUND',
          requiresApproval: false
        });
      }
    }

    // 6. Check for settlement flagged as expense
    if (!row.split_type || row.split_type.trim() === '') {
      if (row.notes && row.notes.toLowerCase().includes('settlement')) {
        rowAnomalies.push({
          rowIndex: i + 2,
          row,
          type: 'SETTLEMENT_AS_EXPENSE',
          severity: 'HIGH',
          description: 'Settlement logged as expense',
          suggestedAction: 'RECLASSIFY_AS_SETTLEMENT',
          requiresApproval: true
        });
      }
    }

    // 7. Check for duplicate (based on date, payer, amount, description)
    if (row.paid_by && parsedDate && !isNaN(amount)) {
      const hash = `${row.paid_by}|${parsedDate.toISOString().split('T')[0]}|${amount}|${row.description}`;
      if (seenExpenses.has(hash)) {
        rowAnomalies.push({
          rowIndex: i + 2,
          row,
          type: 'DUPLICATE_EXPENSE',
          severity: 'HIGH',
          description: 'Likely duplicate of a previous expense',
          suggestedAction: 'REQUIRE_APPROVAL_TO_DELETE',
          requiresApproval: true
        });
      } else {
        seenExpenses.add(hash);
      }
    }

    // 8. Check for percentage split validity
    if (row.split_type === 'percentage' && row.split_details) {
      const percentages = extractPercentages(row.split_details);
      const total = percentages.reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 0.01) {
        // Allow small floating point errors
        rowAnomalies.push({
          rowIndex: i + 2,
          row,
          type: 'INVALID_PERCENTAGE_SUM',
          severity: 'MEDIUM',
          description: `Percentages sum to ${total}%, expected 100%`,
          suggestedAction: 'REQUIRE_NORMALIZATION',
          requiresApproval: true
        });
      }
    }

    // 9. Whitespace normalization
    if (row.paid_by && row.paid_by !== row.paid_by.trim()) {
      rowAnomalies.push({
        rowIndex: i + 2,
        row,
        type: 'WHITESPACE_ERROR',
        severity: 'LOW',
        description: 'Payer name has leading/trailing whitespace',
        suggestedAction: 'NORMALIZE',
        requiresApproval: false
      });
      row.paid_by = row.paid_by.trim();
    }

    // Add anomalies to main list
    anomalies.push(...rowAnomalies);

    // Check if row has critical errors
    const criticalErrors = rowAnomalies.filter(a => a.severity === 'CRITICAL');
    if (criticalErrors.length === 0) {
      validRows.push(row);
    } else {
      rejectedRows.push({ row, reason: criticalErrors.map(a => a.description).join('; ') });
    }
  }

  return {
    anomalies,
    validRows,
    rejectedRows
  };
}

export function parseDate(dateStr: string): Date | null {
  // Try multiple date formats
  const formats = [
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, // M/D/YY
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i, // Mon-YY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      try {
        if (match[3] && match[3].length === 4) {
          // DD-MM-YYYY format
          return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function extractPercentages(splitDetails: string): number[] {
  const matches = splitDetails.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  return matches.map(m => parseFloat(m));
}
