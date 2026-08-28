import { useState } from 'react'
import { FileText, Files, Wand2, TrendingUp, CheckCircle2, Zap } from 'lucide-react'
import CleanTool from './pages/CleanTool'
import BulkTool from './pages/BulkTool'
import ImputeTool from './pages/ImputeTool'
import PredictTool from './pages/PredictTool'
import ValidateTool from './pages/ValidateTool'
import './index.css'

const TOOLS = [
  { id: 'clean',    label: 'Clean',    icon: FileText,    desc: 'Single file' },
  { id: 'bulk',     label: 'Bulk',     icon: Files,       desc: 'Merge + clean' },
  { id: 'impute',   label: 'Impute',   icon: Wand2,       desc: 'Fill gaps' },
  { id: 'predict',  label: 'Predict',  icon: TrendingUp,  desc: 'Next period' },
  { id: 'validate', label: 'Validate', icon: CheckCircle2,desc: 'vs reality' },
]

export default function App() {
  const [active, setActive] = useState('clean')

  const Page = {
    clean: CleanTool,
    bulk: BulkTool,
    impute: ImputeTool,
    predict: PredictTool,
    validate: ValidateTool,
  }[active] || CleanTool

  return (
    <div className="min-h-screen bg-onit-surface flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-onit-border px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-7 h-7 bg-onit-blue rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-onit-dark">DataPrep</span>
        <span className="text-onit-muted text-xs">ONIT Group · AI Unit</span>
        <span className="ml-auto text-xs text-onit-muted">local · v2.0</span>
      </header>

      {/* Tool nav */}
      <nav className="bg-white border-b border-onit-border px-6">
        <div className="flex gap-1">
          {TOOLS.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                active === id
                  ? 'border-onit-blue text-onit-blue'
                  : 'border-transparent text-onit-muted hover:text-onit-dark'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
              <span className="text-xs opacity-60 hidden md:inline">{desc}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Tool content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <Page />
      </main>

    </div>
  )
}
