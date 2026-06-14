import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { importAPI } from '../lib/api';

interface Anomaly {
  id: string;
  rowIndex: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  suggestedAction: string;
  requiresApproval: boolean;
}

function ImportPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [importLogId, setImportLogId] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccessMessage('');
    setSummary(null);
    setAnomalies([]);
    setImportLogId('');

    const text = await file.text();
    setCsvContent(text);
    setFileName(file.name);
  };

  const handlePreview = async () => {
    if (!csvContent || !groupId) {
      setError('Please upload a CSV file first');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsPreviewLoading(true);

    try {
      const { data } = await importAPI.previewCSV(groupId, csvContent);
      setImportLogId(data.importLogId);
      setSummary(data.summary);
      setAnomalies(data.anomalies ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze CSV. Please check the file format.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCompleteImport = async () => {
    if (!groupId || !importLogId) {
      setError('Import session expired. Please analyze the file again.');
      return;
    }

    if (summary?.valid_rows === 0) {
      setError('No valid rows to import. Fix CSV errors and upload again.');
      return;
    }

    setError('');
    setIsFinalizing(true);

    try {
      const approvals: Record<string, boolean> = {};
      anomalies.forEach((anomaly) => {
        if (anomaly.id) {
          approvals[anomaly.id] = true;
        }
      });

      const { data } = await importAPI.finalizeImport(groupId, importLogId, approvals);
      const imported = data.imported ?? 0;
      setSuccessMessage(
        imported > 0
          ? `Successfully imported ${imported} expense(s)!`
          : data.message || 'Import completed.'
      );
      setTimeout(() => navigate(`/groups/${groupId}`), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete import');
    } finally {
      setIsFinalizing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-500 text-red-700';
      case 'HIGH':
        return 'bg-orange-100 border-orange-500 text-orange-700';
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default:
        return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Import Expenses</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {!summary ? (
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload CSV File</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition">
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-lg font-semibold text-gray-900">Click to upload CSV</p>
                <p className="text-sm text-gray-600 mt-2">
                  Columns: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  paid_by: blank = your name · split_with: friend names, &quot;all&quot;, or blank = only you
                </p>
              </label>
            </div>

            {csvContent && (
              <div className="mt-6">
                <p className="text-sm text-gray-600 mb-4">
                  File loaded: <strong>{fileName}</strong> ({Math.max(csvContent.split('\n').length - 1, 0)} rows)
                </p>
                <button
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {isPreviewLoading ? 'Analyzing...' : 'Analyze & Preview'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="card mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Summary</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.total_rows}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Valid</p>
                  <p className="text-2xl font-bold text-green-600">{summary.valid_rows}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{summary.rejected_rows}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Anomalies</p>
                  <p className="text-2xl font-bold text-yellow-600">{anomalies.length}</p>
                </div>
              </div>

              {summary.critical_anomalies > 0 && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg mb-6 flex gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{summary.critical_anomalies} row(s) will be skipped</p>
                    <p className="text-sm">
                      Valid rows ({summary.valid_rows}) will still be imported when you click Complete Import
                    </p>
                  </div>
                </div>
              )}

              {summary.valid_rows === 0 && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                  No valid rows to import. Upload a corrected CSV file.
                </div>
              )}
            </div>

            {anomalies.length > 0 && (
              <div className="card mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Detected Anomalies</h2>

                <div className="space-y-3">
                  {anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-l-4 ${getSeverityColor(anomaly.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">
                            Row {anomaly.rowIndex}: {anomaly.type}
                          </p>
                          <p className="text-sm mt-1">{anomaly.description}</p>
                          <p className="text-xs mt-2">
                            Suggested action: {anomaly.suggestedAction}
                          </p>
                          {anomaly.requiresApproval && (
                            <p className="text-xs font-semibold mt-1">Requires approval</p>
                          )}
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-white bg-opacity-50 rounded">
                          {anomaly.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setSummary(null);
                    setAnomalies([]);
                    setImportLogId('');
                    setError('');
                  }}
                  className="btn-secondary"
                >
                  Upload Different File
                </button>
                <button
                  onClick={handleCompleteImport}
                  disabled={isFinalizing || summary.valid_rows === 0}
                  className="btn-primary disabled:opacity-50"
                >
                  <CheckCircle size={20} className="inline mr-2" />
                  {isFinalizing ? 'Importing...' : `Complete Import (${summary.valid_rows} rows)`}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default ImportPage;
