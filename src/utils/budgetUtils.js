export function getCategorySpent(transactions, categoryId) {
  return transactions.reduce((sum, t) => {
    if (t.splits) {
      return sum + t.splits
        .filter(s => s.categoryId === categoryId)
        .reduce((s, sp) => s + sp.amount, 0)
    }
    return sum + (t.categoryId === categoryId ? (t.amount ?? 0) : 0)
  }, 0)
}

export function getCategoryPlanned(monthBudget, categoryId) {
  return monthBudget?.planned?.[categoryId] ?? 0
}

// Planned amount for a specific subcategory
export function getSubcategoryPlanned(monthBudget, subcategoryId) {
  return monthBudget?.subcategoryPlanned?.[subcategoryId] ?? 0
}

// Amount spent on a specific subcategory
export function getSubcategorySpent(transactions, subcategoryId) {
  return transactions.reduce((sum, t) => {
    if (t.splits) {
      return sum + t.splits
        .filter(s => s.subcategoryId === subcategoryId)
        .reduce((s, sp) => s + sp.amount, 0)
    }
    return sum + (t.subcategoryId === subcategoryId ? (t.amount ?? 0) : 0)
  }, 0)
}

// Effective planned for a category:
//   • Categories with no subcategories → use category-level planned (old model)
//   • Categories with subcategories that have been budgeted → sum subcategory amounts
//   • Categories with subcategories but none budgeted yet → fall back to category-level
//     planned for backward compatibility with data saved before subcategory budgeting
export function getCategoryEffectivePlanned(category, monthBudget) {
  if (category.subcategories.length === 0) {
    return getCategoryPlanned(monthBudget, category.id)
  }
  const hasSubcategoryData = category.subcategories.some(
    sub => monthBudget?.subcategoryPlanned?.[sub.id] !== undefined
  )
  if (hasSubcategoryData) {
    return category.subcategories.reduce(
      (sum, sub) => sum + getSubcategoryPlanned(monthBudget, sub.id),
      0
    )
  }
  // Backward compat: old data stored amounts at the category level
  return getCategoryPlanned(monthBudget, category.id)
}

export function getProgressPercent(spent, planned) {
  if (!planned) return 0
  return Math.min(100, Math.round((spent / planned) * 100))
}

// Returns 'good' | 'warning' | 'over' | 'none'
// type: 'expense' (default) | 'income'
// Expense: green >50% remaining, yellow 0–50% remaining, red only when over budget (spent > planned)
// Income:  neutral < 50% received, yellow 50–99%, green = 100% (goal reached)
export function getProgressStatus(spent, planned, type = 'expense') {
  if (!planned) return 'none'
  const pct = (spent / planned) * 100
  if (type === 'income') {
    if (pct >= 100) return 'good'
    if (pct >= 50) return 'warning'
    return 'none'
  }
  // expense: red only when spending has strictly exceeded the budgeted amount.
  // Guard against floating-point drift: only flag over if more than 1 cent over.
  if (spent - planned > 0.01) return 'over'
  if (pct >= 50) return 'warning'
  return 'good'
}

export function getTotalByType(transactions, type) {
  return transactions
    .filter(t => t.type === type)
    .reduce((sum, t) => sum + (t.amount ?? 0), 0)
}

// Uses getCategoryEffectivePlanned so subcategory budgets roll up correctly
export function getTotalPlannedByType(categories, monthBudget, type) {
  return categories
    .filter(c => c.type === type)
    .reduce((sum, c) => sum + getCategoryEffectivePlanned(c, monthBudget), 0)
}

// Planned income minus planned expenses — should be $0 in a zero-based budget
export function getUnbudgetedAmount(categories, monthBudget) {
  const plannedIncome = getTotalPlannedByType(categories, monthBudget, 'income')
  const plannedExpenses = getTotalPlannedByType(categories, monthBudget, 'expense')
  return plannedIncome - plannedExpenses
}
