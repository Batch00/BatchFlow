export function formatCurrency(amount) {
  // Read currency preference from localStorage on each call so changes take
  // effect on the next render without requiring a context plumb-through.
  let currency = 'USD'
  try {
    const raw = localStorage.getItem('batchflow:preferences')
    if (raw) currency = JSON.parse(raw).currency ?? 'USD'
  } catch {}
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    // Let Intl decide decimal places per currency (e.g. JPY = 0, USD = 2)
  }).format(amount ?? 0)
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

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
