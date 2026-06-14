import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { importAPI } from '../lib/api';

interface Anomaly {
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [importLogId, setImportLogId] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvContent(text);
  };

  const handlePreview = async () => {
    if (!csvContent) return;

    setIsPreviewLoading(true);
    try {
      const { data } = await importAPI.previewCSV(groupId!, csvContent);
      setImportLogId(data.importLogId);
      setSummary(data.summary);
      setAnomalies(data.anomalies);
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setIsPreviewLoading(false);
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Import Expenses</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
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
                  or drag and drop your expenses_export.csv file
                </p>
              </label>
            </div>

            {csvContent && (
              <div className="mt-6">
                <p className="text-sm text-gray-600 mb-4">
                  File loaded: {csvContent.split('\n').length - 1} rows
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
            {/* Summary */}
            <div className="card mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Summary</h2>

              <div className="grid grid-cols-4 gap-4 mb-8">
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
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Critical issues found</p>
                    <p className="text-sm">These rows will be skipped unless corrected</p>
                  </div>
                </div>
              )}
            </div>

            {/* Anomalies */}
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
                            <p className="text-xs font-semibold mt-1">⚠️ Requires approval</p>
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

            {/* Actions */}
            <div className="card">
              <div className="flex gap-4">
                <button onClick={() => { setSummary(null); setAnomalies([]); }} className="btn-secondary">
                  Upload Different File
                </button>
                <button
                  disabled={summary.critical_anomalies > 0}
                  className="btn-primary disabled:opacity-50"
                >
                  <CheckCircle size={20} className="inline mr-2" />
                  Complete Import
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
