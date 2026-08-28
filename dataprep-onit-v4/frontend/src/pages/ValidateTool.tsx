import { useState } from 'react'
import axios from 'axios'
import { DropZone, Stat, RunBtn, Err, Section } from '../components/UI'

export default function ValidateTool() {
  const [predJobId, setPredJobId] = useState('')
  const [realFile, setRealFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!predJobId || !realFile) { setError('Need prediction job ID + real data file'); return }
    setLoading(true); setError(''); setResult(null)
    const form = new FormData()
    form.append('prediction_job_id', predJobId)
    form.append('real_file', realFile)
    try {
      const { data } = await axios.post('/api/validate', form)
      setResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Validation failed') }
    finally { setLoading(false) }
  }

  const verdictColor = {
    good: 'text-green-600',
    acceptable: 'text-amber-600',
    needs_retraining: 'text-red-600'
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-onit-dark">Validate</h1>
        <p className="text-xs text-onit-muted">Compare saved prediction vs real data that arrived</p>
      </div>

      <Section title="Inputs">
        <div>
          <label className="text-xs text-onit-muted block mb-1">Prediction job ID (from Predict step)</label>
          <input value={predJobId} onChange={e => setPredJobId(e.target.value)}
            placeholder="paste job_id from Predict"
            className="w-full border border-onit-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-onit-blue" />
        </div>
        <div className="mt-3">
          <label className="text-xs text-onit-muted block mb-1">Real data (the month/period you predicted)</label>
          <DropZone file={realFile} onFile={setRealFile} />
        </div>
      </Section>

      <RunBtn loading={loading} label="▶ Compare" onClick={run} />
      <Err msg={error} />

      {result && (
        <Section title="Validation Report">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="R² Score" value={result.r2} warn={result.r2 < 0.7} />
            <Stat label="MAE" value={result.mae} />
            <Stat label="RMSE" value={result.rmse} />
            <Stat label="Error %" value={`${result.mape_pct}%`} warn={result.mape_pct > 20} />
          </div>

          <div className={`mt-3 font-semibold text-sm ${verdictColor[result.verdict as keyof typeof verdictColor]}`}>
            {result.verdict === 'good' && '✓ '}
            {result.verdict === 'acceptable' && '⚠ '}
            {result.verdict === 'needs_retraining' && '✗ '}
            {result.verdict_note}
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-onit-muted mb-2">Sample: predicted vs real</p>
            <div className="overflow-x-auto rounded-lg border border-onit-border">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-onit-border">
                  <tr>
                    {['#', 'Predicted', 'Real', 'Error', 'Error %'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-onit-dark">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sample_comparison.map((row: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-onit-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-onit-blue">{row.predicted}</td>
                      <td className="px-3 py-2 font-mono text-onit-dark">{row.real}</td>
                      <td className="px-3 py-2 font-mono text-onit-muted">{row.error}</td>
                      <td className={`px-3 py-2 font-mono ${row.error_pct > 20 ? 'text-red-500' : 'text-green-600'}`}>
                        {row.error_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.verdict === 'needs_retraining' && (
            <p className="text-xs text-onit-muted mt-3 bg-amber-50 px-3 py-2 rounded-lg">
              💡 Next step: go to <strong>Clean → Impute → Predict</strong> and include this real data in the training set. The model improves with each iteration.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}
