import { useState, useRef } from 'react'
import axios from 'axios'
import { Stat, PreviewTable, ExportBar, RunBtn, Err, Section } from '../components/UI'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'

export default function BulkTool() {
  const ref = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [checkResult, setCheckResult] = useState<any>(null)
  const [mergeResult, setMergeResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [strategy, setStrategy] = useState('common_only')
  const [outputFormat, setOutputFormat] = useState('csv')

  const addFiles = (newFiles: FileList) => {
    setFiles(prev => [...prev, ...Array.from(newFiles)])
    setCheckResult(null); setMergeResult(null)
  }

  const check = async () => {
    if (files.length < 2) { setError('Add at least 2 files'); return }
    setLoading(true); setError('')
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    try {
      const { data } = await axios.post('/api/bulk/check', form)
      setCheckResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Check failed') }
    finally { setLoading(false) }
  }

  const merge = async () => {
    setLoading(true); setError('')
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    form.append('mismatch_strategy', strategy)
    form.append('output_format', outputFormat)
    try {
      const { data } = await axios.post('/api/bulk/merge', form)
      setMergeResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Merge failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-onit-dark">Bulk Merge</h1>
        <p className="text-xs text-onit-muted">Stack same-structure files → one combined file</p>
      </div>

      {/* File list */}
      <Section title="Files to Merge">
        <div
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => ref.current?.click()}
          className="border-2 border-dashed border-onit-border rounded-xl p-8 text-center cursor-pointer hover:border-onit-blue hover:bg-blue-50/30 transition-all"
        >
          <input ref={ref} type="file" multiple accept=".csv,.xlsx,.xls,.json"
            className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />
          <Upload size={24} className="text-onit-muted mx-auto mb-2" />
          <p className="text-sm text-onit-dark font-medium">Drop multiple files or click</p>
        </div>
        {files.length > 0 && (
          <div className="space-y-2 mt-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-mono text-onit-dark">{f.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-onit-muted">{(f.size / 1024).toFixed(1)} KB</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Step 1: check */}
      <RunBtn loading={loading} label="① Check Compatibility" onClick={check} />
      <Err msg={error} />

      {/* Compatibility result */}
      {checkResult && (
        <Section title="Column Check">
          <div className={`flex items-center gap-2 text-sm font-medium ${checkResult.compatible ? 'text-green-600' : 'text-amber-600'}`}>
            {checkResult.compatible
              ? <><CheckCircle size={16} /> All files share the same columns — safe to merge</>
              : <><AlertTriangle size={16} /> {checkResult.mismatches.length} column mismatch(es) found</>
            }
          </div>
          {!checkResult.compatible && (
            <div className="space-y-1 mt-2">
              {checkResult.mismatches.map((m: any, i: number) => (
                <div key={i} className="font-mono text-xs text-onit-muted bg-amber-50 px-3 py-2 rounded">
                  <span className="text-amber-700 font-medium">"{m.column}"</span>
                  {' '}— present in: {m.present_in.join(', ')} / missing in: {m.missing_in.join(', ')}
                </div>
              ))}
              <div className="mt-3">
                <label className="text-xs text-onit-muted block mb-1">How to handle mismatches</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)}
                  className="border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
                  <option value="common_only">Keep common columns only</option>
                  <option value="all">Keep all (fill missing with null)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: merge */}
          <div className="mt-3 flex gap-3 items-center">
            <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}
              className="border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="json">JSON</option>
            </select>
            <RunBtn loading={loading} label="② Merge Files" onClick={merge} />
          </div>
        </Section>
      )}

      {mergeResult && <>
        <Section title="Merge Result">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Files merged" value={mergeResult.report.files_merged} />
            <Stat label="Total rows" value={mergeResult.report.total_rows} />
            <Stat label="Columns" value={mergeResult.report.total_cols} />
          </div>
          <p className="text-xs text-onit-muted mt-1">
            💡 Pass this job to the <strong>Impute</strong> or <strong>Predict</strong> tool — job ID: <span className="font-mono">{mergeResult.job_id}</span>
          </p>
        </Section>
        <Section title="Preview">
          <PreviewTable preview={mergeResult.preview} columns={mergeResult.columns} dtypes={{}} />
        </Section>
        <ExportBar onExport={fmt => window.open(`/api/bulk/export/${mergeResult.job_id}/${fmt}`, '_blank')} />
      </>}
    </div>
  )
}
