import { ReactNode, useRef } from 'react'
import { Upload, CheckCircle, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

// -- File drop zone --
export function DropZone({ file, onFile, accept = ".csv,.xlsx,.xls,.json" }: {
  file: File | null, onFile: (f: File) => void, accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
      onDragOver={e => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-onit-border rounded-xl p-8 text-center cursor-pointer hover:border-onit-blue hover:bg-blue-50/30 transition-all"
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      {file ? (
        <div className="flex flex-col items-center gap-1">
          <CheckCircle size={28} className="text-green-500" />
          <p className="font-medium text-sm text-onit-dark">{file.name}</p>
          <p className="text-xs text-onit-muted">{(file.size / 1024).toFixed(1)} KB · click to change</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <Upload size={28} className="text-onit-muted" />
          <p className="text-sm font-medium text-onit-dark">Drop file or click to browse</p>
          <p className="text-xs text-onit-muted">CSV · Excel · JSON</p>
        </div>
      )}
    </div>
  )
}

// -- Stat card --
export function Stat({ label, value, warn }: { label: string, value: string | number, warn?: boolean }) {
  return (
    <div className={`rounded-lg p-4 text-center ${warn ? 'bg-amber-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl font-bold ${warn ? 'text-amber-600' : 'text-onit-dark'}`}>{value}</div>
      <div className="text-xs text-onit-muted mt-0.5">{label}</div>
    </div>
  )
}

// -- Collapsible operation row --
export function OpRow({ op }: { op: { type: string, description: string, details: any[] } }) {
  const [open, setOpen] = useState(false)
  const colors: Record<string, string> = {
    column_rename: 'badge-info', duplicates: 'badge-warning',
    type_inference: 'badge-info', missing_values: 'badge-danger',
    outliers: 'badge-warning', whitespace: 'badge-success'
  }
  return (
    <div className="border border-onit-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
        <div className="flex items-center gap-3">
          <span className={colors[op.type] || 'badge-info'}>{op.type}</span>
          <span className="text-sm text-onit-dark">{op.description}</span>
        </div>
        {op.details?.length > 0 && (open
          ? <ChevronDown size={13} className="text-onit-muted" />
          : <ChevronRight size={13} className="text-onit-muted" />)}
      </button>
      {open && op.details?.length > 0 && (
        <div className="px-4 pb-3 bg-gray-50 border-t border-onit-border space-y-1 pt-2">
          {op.details.map((d: any, i: number) => (
            <p key={i} className="font-mono text-xs text-onit-muted">
              {d.from && d.to ? `"${d.from}" → "${d.to}"` : JSON.stringify(d)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Data preview table --
export function PreviewTable({ preview, columns, dtypes }: {
  preview: Record<string, any>[], columns: string[], dtypes: Record<string, string>
}) {
  if (!preview?.length) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-onit-border">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 border-b border-onit-border">
          <tr>
            {columns.map(c => (
              <th key={c} className="text-left px-3 py-2 font-medium text-onit-dark whitespace-nowrap">
                <div>{c}</div>
                <div className="font-mono font-normal text-[10px] text-onit-muted">{dtypes?.[c]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {columns.map(c => (
                <td key={c} className="px-3 py-2 font-mono text-onit-muted whitespace-nowrap max-w-[160px] truncate">
                  {row[c] === null || row[c] === '' ? <span className="text-red-300 italic">null</span> : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// -- Export buttons --
export function ExportBar({ onExport }: { onExport: (fmt: string) => void }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-onit-muted mb-3">Export cleaned data</p>
      <div className="flex gap-3">
        {['csv', 'excel', 'json'].map(f => (
          <button key={f} onClick={() => onExport(f)} className="btn-ghost flex items-center gap-2">
            <Download size={13} />{f === 'excel' ? 'Excel (.xlsx)' : f.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

// -- Run button --
export function RunBtn({ loading, label, onClick }: { loading: boolean, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
      {loading ? <><Loader2 size={16} className="animate-spin" />Processing…</> : label}
    </button>
  )
}

// -- Error box --
export function Err({ msg }: { msg: string }) {
  if (!msg) return null
  return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{msg}</div>
}

// -- Section header --
export function Section({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-sm text-onit-dark">{title}</h2>
      {children}
    </div>
  )
}

// -- Toggle checkbox --
export function Toggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div onClick={onChange}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${checked ? 'bg-onit-blue border-onit-blue' : 'border-onit-border'}`}>
        {checked && <CheckCircle size={10} className="text-white" />}
      </div>
      <span className="text-xs text-onit-dark">{checked ? '✓' : ''} {label}</span>
    </label>
  )
}
