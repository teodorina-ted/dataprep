import { ArrowRight, Zap, Shield, BarChart2, GitMerge, Cpu, CheckCircle } from 'lucide-react'

const FEATURES = [
  {
    icon: Zap,
    title: 'Smart cleaning',
    desc: 'Remove duplicates, fix formats, normalise columns and strip noise — in one click.',
  },
  {
    icon: Cpu,
    title: 'AI imputation',
    desc: 'Fill missing values using KNN, statistical inference or CTGAN synthetic generation.',
  },
  {
    icon: GitMerge,
    title: 'Bulk merge',
    desc: 'Combine multiple CSV or Excel files, auto-align schemas and flag conflicts.',
  },
  {
    icon: BarChart2,
    title: 'Predictive analytics',
    desc: 'Train Linear Regression, Random Forest or Gradient Boosting models on your data in seconds.',
  },
  {
    icon: Shield,
    title: 'Validation',
    desc: 'Compare cleaned output against a real baseline to catch regressions before they reach production.',
  },
  {
    icon: CheckCircle,
    title: 'PII detection',
    desc: 'Automatically flag emails, phone numbers and ID patterns before sharing or exporting.',
  },
]

const STEPS = [
  { n: '01', label: 'Upload', desc: 'Drop any CSV, Excel or JSON file.' },
  { n: '02', label: 'Configure', desc: 'Choose your cleaning and imputation strategy.' },
  { n: '03', label: 'Run', desc: 'The pipeline processes and scores the result.' },
  { n: '04', label: 'Export', desc: 'Download clean data as CSV, Excel or JSON.' },
]

interface Props {
  onLaunch: () => void
}

export default function LandingPage({ onLaunch }: Props) {
  return (
    <div className="min-h-screen bg-white font-sans text-onit-dark">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-onit-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-onit-blue rounded-lg flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">DataPrep</span>
          </div>
          <button
            onClick={onLaunch}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            Open app <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Geometric background */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <div
            className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #0078D4 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-1/2 -left-20 w-80 h-80 rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #0078D4 0%, transparent 70%)' }}
          />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#0078D4" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 flex flex-col lg:flex-row items-center gap-16">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[11px] font-semibold tracking-[0.18em] uppercase text-onit-blue mb-5">
              AI-powered data preparation
            </span>
            <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Clean data,<br />
              <span style={{ color: '#0078D4' }}>ready to model.</span>
            </h1>
            <p className="text-onit-muted text-lg leading-relaxed max-w-md mb-10">
              Upload messy files. Get structured, imputed, validated data back — without writing a single line of code.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onLaunch}
                className="inline-flex items-center gap-2 bg-onit-blue text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Try it now <ArrowRight size={16} />
              </button>
              <a
                href="https://github.com/teodorina-ted/dataprep"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-onit-border text-onit-muted font-semibold px-7 py-3.5 rounded-xl hover:bg-onit-surface transition-colors"
              >
                View on GitHub
              </a>
            </div>
          </div>

          {/* Right — visual */}
          <div className="flex-1 w-full max-w-lg">
            <div className="relative bg-onit-surface rounded-2xl border border-onit-border p-6 shadow-lg">
              {/* Mock terminal / pipeline visual */}
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400"/>
                <div className="w-3 h-3 rounded-full bg-yellow-400"/>
                <div className="w-3 h-3 rounded-full bg-green-400"/>
                <span className="ml-3 text-xs text-onit-muted font-mono">dataprep · pipeline</span>
              </div>
              <div className="font-mono text-xs space-y-1.5 text-onit-dark">
                {[
                  { label: '→ Reading', value: 'sales_q3.csv  (2,847 rows)', color: 'text-onit-muted' },
                  { label: '→ Found', value: '3 duplicate rows  removed', color: 'text-amber-600' },
                  { label: '→ Found', value: '142 missing values  imputed (KNN)', color: 'text-amber-600' },
                  { label: '→ Found', value: '7 outliers  flagged', color: 'text-amber-600' },
                  { label: '→ PII', value: '2 email columns  detected', color: 'text-red-500' },
                  { label: '✓ Output', value: 'sales_q3_clean.csv  (2,844 rows)', color: 'text-green-600' },
                  { label: '✓ Score', value: 'data quality  94 / 100', color: 'text-green-600' },
                ].map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={line.color}>{line.label}</span>
                    <span className="text-onit-muted">{line.value.split('  ')[0]}</span>
                    {line.value.includes('  ') && (
                      <>
                        <span className="text-onit-border">·</span>
                        <span className={line.color}>{line.value.split('  ')[1]}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* Quality bar */}
              <div className="mt-5 pt-4 border-t border-onit-border">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-onit-muted">Data quality score</span>
                  <span className="font-bold text-green-600">94%</span>
                </div>
                <div className="h-2 bg-onit-border rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '94%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-onit-border bg-onit-surface">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap justify-center gap-10">
          {[
            { n: '5', label: 'pipeline tools' },
            { n: 'CSV · Excel · JSON', label: 'supported formats' },
            { n: '3', label: 'ML model types' },
            { n: '100%', label: 'no-code required' },
          ].map(({ n, label }) => (
            <div key={label} className="text-center">
              <div className="text-xl font-extrabold text-onit-blue">{n}</div>
              <div className="text-xs text-onit-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-2">Everything in one pipeline</h2>
        <p className="text-center text-onit-muted mb-12 max-w-md mx-auto">
          Each tool handles one stage. Run them independently or chain them together.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card hover:shadow-md transition-shadow">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Icon size={17} className="text-onit-blue" />
              </div>
              <h3 className="font-semibold mb-1.5">{title}</h3>
              <p className="text-onit-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-onit-surface border-y border-onit-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, label, desc }) => (
              <div key={n} className="relative">
                <span className="text-5xl font-black text-onit-border leading-none">{n}</span>
                <h3 className="font-bold mt-2 mb-1">{label}</h3>
                <p className="text-onit-muted text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to clean your data?</h2>
        <p className="text-onit-muted mb-8 max-w-sm mx-auto">
          No setup required. Upload a file and the pipeline runs immediately.
        </p>
        <button
          onClick={onLaunch}
          className="inline-flex items-center gap-2 bg-onit-blue text-white font-semibold px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-base"
        >
          Open DataPrep <ArrowRight size={17} />
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-onit-border py-6 text-center text-xs text-onit-muted">
        DataPrep · Built by Teodorina Lungu ·{' '}
        <a href="https://github.com/teodorina-ted/dataprep" target="_blank" rel="noopener noreferrer" className="hover:text-onit-blue">
          GitHub
        </a>{' '}
        ·{' '}
        <a href="https://teodorina.tech" target="_blank" rel="noopener noreferrer" className="hover:text-onit-blue">
          Portfolio
        </a>
      </footer>
    </div>
  )
}
