import { useApp } from '../../context/AppContext'

// Shared affordances for the read-only (demo) account.
//
// The rule everywhere: keep the control visible so a visitor can still see what the
// app offers, but disable it and say why on hover / long-press. Never hide a control
// silently, and never leave one enabled that would fail on click.

export const READ_ONLY_TITLE = 'Disabled in the read-only demo'

// Appended to a button's className. Kept separate from the button's own colors so
// each call site keeps its normal styling and only gains the disabled treatment.
export const disabledCls = 'disabled:opacity-40 disabled:cursor-not-allowed'

export function useReadOnly() {
  const { readOnly } = useApp()
  return readOnly
}

// Spreads onto a <button>: disables it and swaps in the explanatory tooltip.
// `title` is the label to keep when the account is writable.
export function readOnlyProps(readOnly, title) {
  return readOnly
    ? { disabled: true, title: READ_ONLY_TITLE, 'aria-disabled': true }
    : { title }
}

// Inline note for panels whose whole purpose is editing.
export function ReadOnlyNote({ children = 'This demo account is read-only.', className = '' }) {
  return (
    <p className={`text-xs text-amber-600 dark:text-amber-400 ${className}`}>
      {children}
    </p>
  )
}
