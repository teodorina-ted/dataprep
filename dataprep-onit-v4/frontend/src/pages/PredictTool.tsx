import { useState } from 'react'
import axios from 'axios'
import { DropZone, Stat, PreviewTable, ExportBar, RunBtn, Err, Section } from '../components/UI'

const MODELS = [
  { id: 'linear', label: 'Linear Regression', desc: 'Simple, fast, good for linear trends' },
  { id: 'random_forest', label: 'Random Forest', desc: 'Handles complex patterns, recommended' },
  { id: 'gradient_boost', label: 'Gradient Boost', desc: 'Most accurate, slightly slower' }
]

export default function PredictTool() {
  // train
  const [trainFile, setTrainFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState('')
  const [target, setTarget] = useState('')
  const [features, setFeatures] = useState('')
  const [modelType, setModelType] = useState('random_forest')
  const [trainResult, setTrainResult] = useState<any>(null)

  // forecast
  const [forecastFile, setForecastFile] = useState<File | null>(null)
  const [forecastResult, setForecastResult] = useState<any>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [outputFormat, setOutputFormat] = useState('csv')

  const train = async () => {
    if (!target) { setError('Set a target column'); return }
    setLoading(true); setError(''); setTrainResult(null); setForecastResult(null)
    const form = new FormData()
    form.append('target', target)
    form.append('features', features)
    form.append('model', modelType)
    form.append('output_format', outputFormat)
    if (jobId) form.append('job_id', jobId)
    else if (trainFile) form.append('file', trainFile)
    else { setError('Provide file or job ID'); setLoading(false); return }

    try {
      const { data } = await axios.post('/api/predict/train', form)
      setTrainResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Training failed') }
    finally { setLoading(false) }
  }

  const forecast = async () => {
    if (!forecastFile || !trainResult?.model_id) { setError('Train first + upload future data'); return }
    setLoading(true); setError('')
    const form = new FormData()
    form.append('model_id', trainResult.model_id)
    form.append('file', forecastFile)
    form.append('output_format', outputFormat)
    try {
      const { data } = await axios.post('/api/predict/forecast', form)
      setForecastResult(data)
    } catch (e: any) { setError(e.response?.data?.error || 'Forecast failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-onit-dark">Predict</h1>
        <p className="text-xs text-onit-muted">Train on clean history → forecast next period</p>
      </div>

      {/* Step 1: Train */}
      <Section title="① Train — Historical Data">
        <DropZone file={trainFile} onFile={f => { setTrainFile(f); setJobId('') }} />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-onit-muted">or job ID:</span>
          <input value={jobId} onChange={e => { setJobId(e.target.value); setTrainFile(null) }}
            placeholder="paste job_id from Clean/Impute"
            className="flex-1 border border-onit-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-onit-blue" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs text-onit-muted block mb-1">Target column (what to predict)</label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="e.g. irrigate, anomaly_score"
              className="w-full border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue" />
          </div>
          <div>
            <label className="text-xs text-onit-muted block mb-1">Feature columns (leave blank = all numeric)</label>
            <input value={features} onChange={e => setFeatures(e.target.value)}
              placeholder="col1,col2,col3"
              className="w-full border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue" />
          </div>
        </div>

        <div className="space-y-2 mt-3">
          {MODELS.map(m => (
            <div key={m.id} onClick={() => setModelType(m.id)}
              className={`border-2 rounded-lg px-4 py-3 cursor-pointer transition-all flex items-center justify-between ${modelType === m.id ? 'border-onit-blue bg-blue-50/30' : 'border-onit-border hover:border-blue-200'}`}>
              <div>
                <p className="text-sm font-medium text-onit-dark">{m.label}</p>
                <p className="text-xs text-onit-muted">{m.desc}</p>
              </div>
              {modelType === m.id && <span className="text-xs text-onit-blue font-medium">selected</span>}
            </div>
          ))}
        </div>
        <RunBtn loading={loading} label="▶ Train Model" onClick={train} />
      </Section>

      <Err msg={error} />

      {trainResult && (
        <Section title="Training Result">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="R² Score" value={trainResult.r2} warn={trainResult.r2 < 0.7} />
            <Stat label="MAE" value={trainResult.mae} />
          </div>
          <p className="text-xs text-onit-muted mt-1">{trainResult.accuracy_note}</p>
          <p className="text-xs text-green-600 font-medium mt-1">
            {trainResult.r2 > 0.8 ? '✓ Good model — proceed to forecast'
              : trainResult.r2 > 0.5 ? '⚠ Acceptable — more data would help'
              : '✗ Weak — consider more features or cleaning the data better'}
          </p>
          <p className="text-xs font-mono text-onit-muted mt-2">model_id: {trainResult.model_id}</p>
        </Section>
      )}

      {/* Step 2: Forecast */}
      {trainResult && (
        <Section title="② Forecast — Future / New Data">
          <p className="text-xs text-onit-muted mb-3">Upload new data with the same feature columns. Model adds a prediction column.</p>
          <DropZone file={forecastFile} onFile={setForecastFile} />
          <div className="mt-3 flex gap-3 items-center">
            <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}
              className="border border-onit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-onit-blue">
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="json">JSON</option>
            </select>
            <RunBtn loading={loading} label="▶ Forecast" onClick={forecast} />
          </div>
        </Section>
      )}

      {forecastResult && <>
        <Section title="Forecast Preview">
          <p className="text-xs text-green-600 font-medium mb-2">
            ✓ Column added: <span className="font-mono">{forecastResult.predicted_column}</span>
          </p>
          <PreviewTable preview={forecastResult.preview} columns={forecastResult.columns} dtypes={{}} />
          <p className="text-xs text-onit-muted mt-2">
            Save this job ID for Validate: <span className="font-mono text-onit-dark">{forecastResult.job_id}</span>
          </p>
        </Section>
        <ExportBar onExport={fmt => window.open(`/api/predict/export/${forecastResult.job_id}/${fmt}`, '_blank')} />
      </>}
    </div>
  )
}
