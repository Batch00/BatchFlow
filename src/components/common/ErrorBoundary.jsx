import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

// Contains a render failure to the smallest useful unit.
//
// Wrap this around each row of a list rather than the list as a whole: a single
// malformed record then degrades to a placeholder row while every other row — and
// the rest of the page — keeps rendering. Without a boundary, one bad row throws
// during render and React unmounts the entire tree, white-screening the view.
//
// Error boundaries have to be class components; there is no hook equivalent.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error(`Render failed${this.props.label ? ` in ${this.props.label}` : ''}:`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return <ErrorRow />
  }
}

// Renders a function's result. The indirection matters: a boundary only catches
// what throws while React renders its OWN subtree, so passing already-built JSX
// (`<ErrorBoundary>{buildRow(t)}</ErrorBoundary>`) catches nothing — buildRow ran
// in the parent's render. Deferring the call into this child puts it inside the
// boundary, where a throw is contained.
function Deferred({ render }) {
  return render()
}

// Wraps one list row. Pass the row as a function:
//   <GuardedRow key={t.id} label={t.id}>{() => renderRow(t)}</GuardedRow>
export function GuardedRow({ label, fallback, children }) {
  return (
    <ErrorBoundary label={label} fallback={fallback}>
      <Deferred render={children} />
    </ErrorBoundary>
  )
}

// Default placeholder — sized and padded like a normal list row so a failure does
// not visibly collapse the layout around it.
export function ErrorRow({ message = "This item couldn't be displayed." }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
      <p className="flex-1 min-w-0 text-xs text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}
