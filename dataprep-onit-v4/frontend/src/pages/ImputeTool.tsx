import { useState } from 'react'
import axios from 'axios'
import { DropZone, Stat, PreviewTable, ExportBar, RunBtn, Err, Section } from '../components/UI'

const METHODS = [
  {
    id: 'mean', label: 'Mean / Median / Mode',
    desc: 'Fill gaps with column average or most common value.',
    pros: ['Fast', 'No training needed', 'Works on any size'],
    cons: ['Dumb — ignores relationships between columns']
  },
  {
    id: 'knn', label: 'KNN (Smart)',
    desc: 'Uses other columns to estimate what the missing value should be.',
    pros: ['Accurate', 'Uses data relationships', 'Good for sensor data'],
    cons: ['Slower on large files', 'Numeric columns only']
  },
  {
    id: 'ctgan', label: 'CTGAN (Synthetic)',
    desc: 'Generates realistic synthetic rows to replace missing blocks.',
    pros: ['Most realistic', 'Preserves data distribution'],
    cons: ['Slow (20–60 min on 10k rows)', 'Needs 100+ complete rows to train', 'Heavy compute']
  }
]

export default function ImputeTool() {
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState('')
  const [method, setMethod] = useState('mean')
  const [subMethod, setSubMethod] = useState('mean')
  const [k, setK] = useState(5)
  const [epochs, setEpochs] = useState(300)
  const [outputFormat, setOutputFormat] = useState('csv')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setError(''); setResult(null)
    const form = new FormData()
    const finalMethod = method === 'mean' ? subMethod : method
    form.append('method', finalMethod)
    form.append('output_format', outputFormat)
    if (method === 'knn') form.append('k', String(k))
    if (method === 'ctgan') form.append('epochs', String(epochs))
    if (jobId) form.append('job_id', jobId)
    else if (file) form.append('file', file)
    else { setError('Provide a file or job ID'); setLoading(false); return }

    try {
      const { data } = await axios.post('/api/impute', form)
      setResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Imputation failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-onit-dark">Impute</h1>
        <p className="text-xs text-onit-muted">Fill missing values intelligently</p>
      </div>

      {/* Source */}
      <Section title="Data Source">
        <p className="text-xs text-onit-muted mb-2">Upload a file or pass a job ID from Clean / Bulk</p>
        <DropZone file={file} onFile={f => { setFile(f); setJobId('') }} />
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-onit-muted">or job ID:</span>
          <input value={jobId} onChange={e => { setJobId(e.target.value); setFile(null) }}
            placeholder="paste job_id from previous step"
            className="flex-1 border border-onit-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-onit-blue" />
        </div>
      </Section>

      {/* Method selector */}
      <Section title="Choose Method">
        <div className="space-y-3">
          {METHODS.map(m => (
            <div key={m.id}
              onClick={() => setMethod(m.id)}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${method === m.id ? 'border-onit-blue bg-blue-50/30' : 'border-onit-border hover:border-blue-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-onit-dark">{m.label}</span>
                {method === m.id && <span className="text-xs text-onit-blue font-medium">selected</span>}
              </div>
              <p className="text-xs text-onit-muted mb-2">{m.desc}</p>
              <div className="flex gap-4 text-xs">
                <div>
                  {m.pros.map((p, i) => <p key={i} className="text-green-600">✓ {p}</p>)}
                </div>
                <div>
                  {m.cons.map((c, i) => <p key={i} className="text-red-500">✗ {c}</p>)}
                </div>
              </div>

              {/* Sub-options when selected */}
              {method === m.id && m.id === 'mean' && (
                <select value={subMethod} onChange={e => setSubMethod(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="mt-3 border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
                  <option value="mean">Mean</option>
                  <option value="median">Median</option>
                  <option value="mode">Mode</option>
                </select>
              )}
              {method === m.id && m.id === 'knn' && (
                <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-onit-muted">Neighbors (k):</span>
                  <input type="number" value={k} min={1} max={20} onChange={e => setK(Number(e.target.value))}
                    className="w-16 border border-onit-border rounded px-2 py-1 text-sm text-center" />
                </div>
              )}
              {method === m.id && m.id === 'ctgan' && (
                <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-onit-muted">Epochs:</span>
                  <input type="number" value={epochs} min={100} max={1000} step={100}
                    onChange={e => setEpochs(Number(e.target.value))}
                    className="w-20 border border-onit-border rounded px-2 py-1 text-sm text-center" />
                  <span className="text-xs text-amber-600">⚠ Will take time</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-xs text-onit-muted block mb-1">Export as</label>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}
            className="border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>
        </div>
      </Section>

      <RunBtn loading={loading} label="▶ Run Imputation" onClick={run} />
      <Err msg={error} />

      {result && <>
        <Section title="Result">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Missing before" value={result.report.missing_before} warn={result.report.missing_before > 0} />
            <Stat label="Filled" value={result.report.filled} />
            <Stat label="Missing after" value={result.report.missing_after} warn={result.report.missing_after > 0} />
          </div>
          <p className="text-xs text-onit-muted mt-2">
            Job ID for next step: <span className="font-mono text-onit-dark">{result.job_id}</span>
          </p>
        </Section>
        <Section title="Preview">
          <PreviewTable preview={result.preview} columns={result.columns} dtypes={result.dtypes} />
        </Section>
        <ExportBar onExport={fmt => window.open(`/api/impute/export/${result.job_id}/${fmt}`, '_blank')} />
      </>}
    </div>
  )
}
