// ── Recurring transaction utilities ──────────────────────────────────────────

export const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

// Pad date parts to YYYY-MM-DD string (using local time to avoid DST shift)
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse YYYY-MM-DD at noon local time to avoid DST edge cases
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/**
 * Returns all dates (YYYY-MM-DD strings) when a recurring rule fires within
 * the given monthKey (YYYY-MM).
 *
 * rule must have: { frequency, startDate, endDate (nullable) }
 */
export function getOccurrencesInMonth(rule, monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1, 12, 0, 0)
  const monthEnd   = new Date(year, month, 0, 12, 0, 0) // last day of month

  const ruleStart = parseDate(rule.startDate)
  if (ruleStart > monthEnd) return [] // rule hasn't started yet

  const ruleEnd = rule.endDate ? parseDate(rule.endDate) : null
  if (ruleEnd && ruleEnd < monthStart) return [] // rule already ended

  const results = []

  if (rule.frequency === 'monthly') {
    const targetDay = ruleStart.getDate()
    const daysInMonth = new Date(year, month, 0).getDate()
    const actualDay = Math.min(targetDay, daysInMonth)
    const occurrence = new Date(year, month - 1, actualDay, 12, 0, 0)
    if (occurrence >= ruleStart && (!ruleEnd || occurrence <= ruleEnd)) {
      results.push(toDateStr(occurrence))
    }
  } else if (rule.frequency === 'yearly') {
    const targetMonth = ruleStart.getMonth() // 0-indexed
    if (targetMonth === month - 1) {
      const targetDay = ruleStart.getDate()
      const daysInMonth = new Date(year, month, 0).getDate()
      const actualDay = Math.min(targetDay, daysInMonth)
      const occurrence = new Date(year, month - 1, actualDay, 12, 0, 0)
      if (occurrence >= ruleStart && (!ruleEnd || occurrence <= ruleEnd)) {
        results.push(toDateStr(occurrence))
      }
    }
  } else {
    // weekly (7 days) or biweekly (14 days) — iterate from rule start.
    // Step by calendar days (re-anchored to noon each time) rather than a fixed
    // millisecond delta, so DST transitions don't drift the time-of-day and
    // cause the last-day-of-month boundary comparison to miss an occurrence.
    const stepDays = rule.frequency === 'weekly' ? 7 : 14
    const advance = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate() + stepDays, 12, 0, 0)
    let current = new Date(ruleStart)
    // Advance to first occurrence >= monthStart
    while (current < monthStart) {
      current = advance(current)
    }
    while (current <= monthEnd) {
      if (!ruleEnd || current <= ruleEnd) {
        results.push(toDateStr(current))
      }
      current = advance(current)
    }
  }

  return results
}

/**
 * Returns the next occurrence date string (YYYY-MM-DD) on or after today,
 * or null if the rule has ended or will never fire again.
 * Searches up to 24 months ahead.
 */
export function getNextOccurrence(rule) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayStr = toDateStr(today)

  const searchDate = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0)
  for (let i = 0; i < 24; i++) {
    const y = searchDate.getFullYear()
    const m = searchDate.getMonth() + 1
    const monthKey = `${y}-${String(m).padStart(2, '0')}`
    const occurrences = getOccurrencesInMonth(rule, monthKey)
    for (const d of occurrences) {
      if (d >= todayStr) return d
    }
    searchDate.setMonth(searchDate.getMonth() + 1)
  }
  return null
}
