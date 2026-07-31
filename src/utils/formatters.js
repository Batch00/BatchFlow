// Any space Intl emits inside a currency string (e.g. "CHF 1,234.56", "1.234,56 €")
// is replaced with a non-breaking space so a formatted amount can never be split
// across two lines. Pair with `whitespace-nowrap` on the rendering element.
const NBSP = ' '
// U+0020 space, U+202F narrow no-break space, U+2009 thin space
const BREAKABLE_SPACES = /[   ]/g

function makeNonBreaking(str) {
  return str.replace(BREAKABLE_SPACES, NBSP)
}

export function formatCurrency(amount) {
  // Read currency preference from localStorage on each call so changes take
  // effect on the next render without requiring a context plumb-through.
  let currency = 'USD'
  try {
    const raw = localStorage.getItem('batchflow:preferences')
    if (raw) currency = JSON.parse(raw).currency ?? 'USD'
  } catch {}
  return makeNonBreaking(new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    // Let Intl decide decimal places per currency (e.g. JPY = 0, USD = 2)
  }).format(amount ?? 0))
}

// Signed amount rendered as a single unbreakable string: "+$2,500.00" / "−$45.20".
// Returning one string (rather than a sign node adjacent to the amount) guarantees
// the sign and the number always stay together on the same line.
export function formatSignedCurrency(amount, type) {
  const sign = type === 'income' ? '+' : '−' // U+2212 MINUS SIGN
  return `${sign}${formatCurrency(amount)}`
}

export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Compact form for tight mobile rows: "Jan 15" (year dropped when it is the current year)
export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const opts = date.getFullYear() === new Date().getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  return makeNonBreaking(date.toLocaleDateString('en-US', opts))
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
