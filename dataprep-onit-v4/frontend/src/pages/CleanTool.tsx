import { useState } from 'react'
import axios from 'axios'
import { DropZone, Stat, OpRow, PreviewTable, ExportBar, RunBtn, Err, Section, Toggle } from '../components/UI'
import { Shield, AlertTriangle, CheckCircle, Clock, History } from 'lucide-react'

interface Issue {
  type: string; description: string; details: any[]; fixable?: boolean
}

export default function CleanTool() {
  const [file, setFile] = useState<File | null>(null)
  const [sqlMode, setSqlMode] = useState(false)
  const [sqlConn, setSqlConn] = useState('')
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM data LIMIT 1000')

  const [opts, setOpts] = useState({
    standardize_columns: true, remove_duplicates: true,
    fix_types: true, detect_outliers: true, trim_whitespace: true
  })

  // missing strategies per column type
  const [missingNum, setMissingNum] = useState<string[]>(['flag'])
  const [missingText, setMissingText] = useState<string[]>(['flag'])

  const [outputFormat, setOutputFormat] = useState('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // two-step state
  const [scanResult, setScanResult] = useState<any>(null)
  const [cleanResult, setCleanResult] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showNotification, setShowNotification] = useState(false)

  const toggle = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }))

  const toggleStrategy = (list: string[], setList: (v: string[]) => void, val: string) => {
    if (list.includes(val)) setList(list.filter(v => v !== val))
    else setList([...list, val])
  }

  // STEP 1: scan
  const scan = async () => {
    setLoading(true); setError(''); setScanResult(null); setCleanResult(null); setShowNotification(false)
    const form = new FormData()
    if (sqlMode) {
      form.append('sql_mode', 'true')
      form.append('connection_string', sqlConn)
      form.append('sql_query', sqlQuery)
    } else {
      if (!file) { setError('Select a file'); setLoading(false); return }
      form.append('file', file)
    }
    Object.entries(opts).forEach(([k, v]) => form.append(k, String(v)))
    try {
      const { data } = await axios.post('/api/clean/scan', form)
      setScanResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Scan failed') }
    finally { setLoading(false) }
  }

  // STEP 2: apply
  const apply = async () => {
    if (!scanResult) return
    setLoading(true); setError('')
    const strategies: Record<string, string> = {
      _default_numeric: missingNum[0] || 'flag',
      _default_text: missingText[0] || 'flag'
    }
    try {
      const { data } = await axios.post('/api/clean/apply', {
        scan_id: scanResult.scan_id,
        options: opts,
        missing_strategies: strategies,
        output_format: outputFormat
      })
      setCleanResult(data)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 5000)
    } catch (e: any) { setError(e.response?.data?.error || 'Cleaning failed') }
    finally { setLoading(false) }
  }

  // history
  const loadHistory = async () => {
    try {
      const { data } = await axios.get('/api/clean/history')
      setHistory(data)
      setShowHistory(true)
    } catch { setHistory([]) }
  }

  const exportFile = (fmt: string) => {
    if (cleanResult) window.open(`/api/clean/export/${cleanResult.job_id}/${fmt}`, '_blank')
  }

  return (
    <div className="space-y-5">
      {/* notification toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <CheckCircle size={18} /> Cleaning complete!
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-onit-dark">Single File Clean</h1>
          <p className="text-xs text-onit-muted">Scan → Review → Approve → Export</p>
        </div>
        <button onClick={loadHistory} className="btn-ghost flex items-center gap-2 text-xs">
          <History size={13} /> History
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <Section title="Cleaning History">
          {history.length === 0
            ? <p className="text-xs text-onit-muted">No history yet</p>
            : <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-4 py-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono text-onit-dark">{h.filename}</span>
                      <span className="text-onit-muted ml-2">{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge-info">{h.report?.original_rows}→{h.report?.final_rows} rows</span>
                      <span className="badge-warning">{h.report?.operations?.length || 0} ops</span>
                      {h.pii_warnings?.length > 0 && <span className="badge-danger">PII</span>}
                    </div>
                  </div>
                ))}
              </div>
          }
          <button onClick={() => setShowHistory(false)} className="text-xs text-onit-muted mt-2 hover:underline">close</button>
        </Section>
      )}

      {/* Source */}
      <Section title="Data Source">
        <div className="flex gap-2 mb-3">
          {['file', 'sql'].map(m => (
            <button key={m} onClick={() => setSqlMode(m === 'sql')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                (m === 'sql') === sqlMode ? 'bg-onit-blue text-white' : 'text-onit-muted hover:bg-gray-100'}`}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        {!sqlMode
          ? <DropZone file={file} onFile={f => { setFile(f); setScanResult(null); setCleanResult(null) }} />
          : <div className="space-y-3">
              <input value={sqlConn} onChange={e => setSqlConn(e.target.value)}
                placeholder="/path/to/database.db"
                className="w-full border border-onit-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-onit-blue" />
              <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} rows={3}
                className="w-full border border-onit-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-onit-blue" />
            </div>
        }
      </Section>

      {/* Options */}
      <Section title="Cleaning Options">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(opts).map(([k, v]) => (
            <Toggle key={k} label={k.replace(/_/g, ' ')} checked={v} onChange={() => toggle(k as keyof typeof opts)} />
          ))}
        </div>

        <p className="text-xs font-medium text-onit-dark mb-2">Missing values — numeric columns</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          {['flag', 'drop_rows', 'fill_mean', 'fill_median'].map(s => (
            <button key={s} onClick={() => toggleStrategy(missingNum, setMissingNum, s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                missingNum.includes(s) ? 'bg-onit-blue text-white border-onit-blue' : 'border-onit-border text-onit-muted hover:bg-gray-50'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-onit-dark mb-2">Missing values — text columns</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          {['flag', 'drop_rows', 'fill_mode'].map(s => (
            <button key={s} onClick={() => toggleStrategy(missingText, setMissingText, s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                missingText.includes(s) ? 'bg-onit-blue text-white border-onit-blue' : 'border-onit-border text-onit-muted hover:bg-gray-50'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-onit-muted block mb-1">Export as</label>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}
            className="border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </Section>

      {/* STEP 1: Scan */}
      <RunBtn loading={loading && !scanResult} label="① Scan File (no changes yet)" onClick={scan} />
      <Err msg={error} />

      {/* Scan results */}
      {scanResult && !cleanResult && (
        <>
          <Section title="Scan Results — Review Before Cleaning">
            {scanResult.issues.length === 0
              ? <p className="text-sm text-green-600 font-medium">✓ File is already clean!</p>
              : <div className="space-y-3">
                  {scanResult.issues.map((issue: Issue, i: number) => (
                    <div key={i} className={`border rounded-xl p-4 ${
                      issue.type === 'pii_warning' ? 'border-red-300 bg-red-50' : 'border-onit-border'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {issue.type === 'pii_warning'
                          ? <Shield size={14} className="text-red-500" />
                          : issue.fixable
                            ? <CheckCircle size={14} className="text-green-500" />
                            : <AlertTriangle size={14} className="text-amber-500" />
                        }
                        <span className={`text-sm font-medium ${issue.type === 'pii_warning' ? 'text-red-700' : 'text-onit-dark'}`}>
                          {issue.description}
                        </span>
                        {issue.fixable && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">will fix</span>}
                        {!issue.fixable && issue.type !== 'pii_warning' && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">flag only</span>}
                      </div>
                      {issue.details?.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {issue.details.slice(0, 10).map((d: any, j: number) => (
                            <p key={j} className="font-mono text-xs text-onit-muted">
                              {d.column && d.missing_count ? `${d.column}: ${d.missing_count} missing${d.is_numeric ? ' (numeric)' : ' (text)'}` :
                               d.from && d.to ? `"${d.from}" → "${d.to}"` :
                               d.column && d.type ? `${d.column} — ${d.type}: ${d.reason}` :
                               d.column && d.outlier_count ? `${d.column}: ${d.outlier_count} outlier(s) [${d.lower_bound} – ${d.upper_bound}]` :
                               JSON.stringify(d)}
                            </p>
                          ))}
                          {issue.details.length > 10 && <p className="text-xs text-onit-muted">...and {issue.details.length - 10} more</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            }
          </Section>

          <Section title="Raw Data Preview">
            <PreviewTable preview={scanResult.preview} columns={scanResult.columns} dtypes={scanResult.dtypes} />
          </Section>

          {/* STEP 2: Approve */}
          <RunBtn loading={loading} label="② Approve & Clean" onClick={apply} />
        </>
      )}

      {/* Clean results */}
      {cleanResult && (
        <>
          <Section title="Cleaning Report">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Original rows" value={cleanResult.report.original_rows} />
              <Stat label="Final rows" value={cleanResult.report.final_rows} />
              <Stat label="Removed" value={cleanResult.report.rows_removed} warn={cleanResult.report.rows_removed > 0} />
              <Stat label="Operations" value={cleanResult.report.operations.length} />
            </div>
            <div className="space-y-2 mt-3">
              {cleanResult.report.operations.map((op: any, i: number) => <OpRow key={i} op={op} />)}
            </div>
          </Section>

          {cleanResult.pii_warnings?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-red-500" />
                <span className="font-semibold text-sm text-red-700">GDPR Warning — Personal Data Detected</span>
              </div>
              {cleanResult.pii_warnings.map((w: any, i: number) => (
                <p key={i} className="text-xs text-red-600 font-mono">
                  {w.details?.map((d: any) => `${d.column} (${d.type})`).join(', ')}
                </p>
              ))}
            </div>
          )}

          {cleanResult.changes_log?.length > 0 && (
            <Section title="Audit Log (cell-level changes)">
              <div className="max-h-48 overflow-y-auto space-y-1">
                {cleanResult.changes_log.map((c: any, i: number) => (
                  <p key={i} className="font-mono text-xs text-onit-muted">
                    {c.action === 'rename_column' && `Column "${c.from}" → "${c.to}"`}
                    {c.action === 'remove_duplicates' && `Removed ${c.rows_removed} duplicate rows`}
                    {c.action === 'fix_type' && `${c.column}: ${c.from} → ${c.to}`}
                    {c.action === 'fill_missing' && `${c.column}: filled ${c.count} gaps (${c.strategy})`}
                    {c.action === 'trim_whitespace' && `Trimmed: ${c.columns?.join(', ')}`}
                  </p>
                ))}
              </div>
            </Section>
          )}

          <Section title="Cleaned Preview">
            <PreviewTable preview={cleanResult.preview} columns={cleanResult.columns} dtypes={cleanResult.dtypes} />
          </Section>

          <ExportBar onExport={exportFile} />

          <p className="text-xs text-onit-muted text-center">
            Job ID: <span className="font-mono">{cleanResult.job_id}</span> — pass this to Impute or Predict
          </p>
        </>
      )}
    </div>
  )
}
