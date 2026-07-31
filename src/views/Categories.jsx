import { useState, useMemo } from 'react'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, ChevronDown, ChevronRight,
  Pencil, Trash2, ArrowUp, ArrowDown,
  Check, X, GripVertical,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { disabledCls, readOnlyProps } from '../components/common/ReadOnly'
import CategoryModal from '../components/categories/CategoryModal'

// Icon buttons need a comfortable tap target on touch screens but should stay
// compact on desktop where they sit in a dense row.
const ICON_BTN = 'p-2 sm:p-1.5 rounded-lg transition-colors'

// ── SortableSubcategoryRow ────────────────────────────────────────────────────

function SortableSubcategoryRow({ categoryId, sub, transactionCount, readOnly }) {
  const { updateSubcategory, deleteSubcategory } = useApp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(sub.name)

  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: sub.id, disabled: readOnly })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const startEdit = () => { if (readOnly) return; setValue(sub.name); setEditing(true) }

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== sub.name) updateSubcategory(categoryId, sub.id, trimmed)
    else setValue(sub.name)
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setValue(sub.name); setEditing(false) }
  }

  const handleDelete = () => {
    if (readOnly) return
    const msg = transactionCount > 0
      ? `"${sub.name}" is used in ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}. Those transactions will keep their data but will no longer have a subcategory. Delete anyway?`
      : `Delete subcategory "${sub.name}"?`
    if (window.confirm(msg)) deleteSubcategory(categoryId, sub.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 group px-2 py-1.5 rounded-lg transition-colors ${
        isDragging ? 'opacity-50 bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
      }`}
    >
      {/* Drag handle — omitted entirely when reordering is not possible */}
      {!readOnly && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical size={13} />
        </button>
      )}

      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0" />

      {editing ? (
        <>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200 border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700"
          />
          <button onClick={commit} className={`${ICON_BTN} text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex-shrink-0`} title="Save">
            <Check size={13} />
          </button>
          <button onClick={() => { setValue(sub.name); setEditing(false) }} className={`${ICON_BTN} text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0`} title="Cancel">
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <span
            className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-slate-300 cursor-default select-none"
            onDoubleClick={startEdit}
            title={readOnly ? sub.name : `${sub.name} — double-click to rename`}
          >{sub.name}</span>
          {transactionCount > 0 && (
            <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">{transactionCount}</span>
          )}
          {!readOnly && (
            <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
              <button
                onClick={startEdit}
                className={`${ICON_BTN} text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30`}
                title="Rename"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={handleDelete}
                className={`${ICON_BTN} text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30`}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── AddSubcategoryInput ────────────────────────────────────────────────────────

function AddSubcategoryInput({ onAdd, onCancel }) {
  const [value, setValue] = useState('')

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) onAdd(trimmed)
    else onCancel()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Subcategory name…"
        autoFocus
        className="flex-1 min-w-0 text-sm border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
      />
      <button onClick={commit} className={`${ICON_BTN} text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex-shrink-0`} title="Add">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className={`${ICON_BTN} text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0`} title="Cancel">
        <X size={14} />
      </button>
    </div>
  )
}

// ── CategoryCard ───────────────────────────────────────────────────────────────
//
// Two-line header. The name owns the full width of line 1 so it is never squeezed
// out by the metadata chips or the action buttons — that crowding was what made the
// name invisible at mobile widths. Metadata and actions share line 2.

function CategoryCard({ category, isFirst, isLast, transactions, onEdit, onDelete, onMove, readOnly }) {
  const { addSubcategory, moveSubcategory, updateCategory } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [addingSubcat, setAddingSubcat] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameValue, setNameValue] = useState(category.name)

  const startNameEdit = () => { if (readOnly) return; setNameValue(category.name); setNameEditing(true) }

  const commitName = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== category.name) {
      updateCategory(category.id, { name: trimmed, color: category.color })
    } else {
      setNameValue(category.name)
    }
    setNameEditing(false)
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitName() }
    if (e.key === 'Escape') { setNameValue(category.name); setNameEditing(false) }
  }

  const catTransactionCount = transactions.filter(t =>
    t.splits ? t.splits.some(s => s.categoryId === category.id) : t.categoryId === category.id
  ).length
  const isIncome = category.type === 'income'

  const getSubTransactionCount = (subId) =>
    transactions.filter(t =>
      t.splits ? t.splits.some(s => s.subcategoryId === subId) : t.subcategoryId === subId
    ).length

  // No sensors in read-only mode — nothing can start a drag
  const activeSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const sensors = readOnly ? [] : activeSensors

  const handleSubcatDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      moveSubcategory(category.id, active.id, over.id)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-3 sm:px-4 py-3">
        {/* Line 1 — colour dot, name, expand chevron */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />

          {nameEditing ? (
            <>
              <input
                type="text"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={handleNameKeyDown}
                autoFocus
                className="flex-1 min-w-0 text-sm font-semibold border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onMouseDown={e => e.preventDefault()} // keep focus on input
                onClick={commitName}
                className={`${ICON_BTN} text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex-shrink-0`}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setNameValue(category.name); setNameEditing(false) }}
                className={`${ICON_BTN} text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0`}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex-1 flex items-center justify-between gap-2 text-left min-w-0 py-1.5"
              aria-expanded={expanded}
            >
              <span
                className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
                onDoubleClick={e => { e.stopPropagation(); startNameEdit() }}
                title={readOnly ? category.name : `${category.name} — double-click to rename`}
              >
                {category.name}
              </span>
              {expanded
                ? <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
                : <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />
              }
            </button>
          )}
        </div>

        {/* Line 2 — metadata on the left, actions on the right */}
        {!nameEditing && (
          <div className="flex items-center justify-between gap-2 mt-1.5 pl-[22px]">
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 min-w-0 text-xs">
              <span className={`px-1.5 py-0.5 rounded-md font-medium ${
                isIncome
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {category.type}
              </span>
              <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {category.subcategories.length} sub{category.subcategories.length !== 1 ? 's' : ''}
              </span>
              {catTransactionCount > 0 && (
                <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  · {catTransactionCount} txn{catTransactionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!readOnly && (
              <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1">
                <button
                  onClick={() => onMove('up')}
                  disabled={isFirst}
                  title="Move up"
                  className={`${ICON_BTN} text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => onMove('down')}
                  disabled={isLast}
                  title="Move down"
                  className={`${ICON_BTN} text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={onEdit}
                  title="Edit category"
                  className={`${ICON_BTN} text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={onDelete}
                  title="Delete category"
                  className={`${ICON_BTN} text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subcategory panel */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-2 py-2">
          {category.subcategories.length === 0 && !addingSubcat && (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-3 py-1.5">No subcategories yet.</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSubcatDragEnd}
          >
            <SortableContext
              items={category.subcategories.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {category.subcategories.map(sub => (
                <SortableSubcategoryRow
                  key={sub.id}
                  categoryId={category.id}
                  sub={sub}
                  transactionCount={getSubTransactionCount(sub.id)}
                  readOnly={readOnly}
                />
              ))}
            </SortableContext>
          </DndContext>

          {!readOnly && (addingSubcat ? (
            <AddSubcategoryInput
              onAdd={name => { addSubcategory(category.id, name); setAddingSubcat(false) }}
              onCancel={() => setAddingSubcat(false)}
            />
          ) : (
            <button
              onClick={() => setAddingSubcat(true)}
              className="flex items-center gap-1.5 px-3 py-2 w-full text-left text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors mt-1"
            >
              <Plus size={12} />
              Add subcategory
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Categories (main view) ─────────────────────────────────────────────────────

export default function Categories() {
  const {
    categories, transactions, currentMonth,
    addCategory, updateCategory, deleteCategory, moveCategory,
    readOnly,
  } = useApp()

  // Scope transaction counts to the currently viewed month
  const monthTransactions = useMemo(
    () => transactions.filter(t => t.date?.startsWith(currentMonth)),
    [transactions, currentMonth]
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const openAdd = () => { if (readOnly) return; setEditingCategory(null); setModalOpen(true) }
  const openEdit = (cat) => { if (readOnly) return; setEditingCategory(cat); setModalOpen(true) }

  const handleSave = (data) => {
    if (editingCategory) updateCategory(editingCategory.id, data)
    else addCategory(data)
  }

  const handleDelete = (cat) => {
    if (readOnly) return
    const count = transactions.filter(t => t.categoryId === cat.id).length
    const msg = count > 0
      ? `"${cat.name}" is used in ${count} transaction${count !== 1 ? 's' : ''}. Deleting it will not remove those transactions, but they will show an unknown category. Delete anyway?`
      : `Delete "${cat.name}"? This will also remove all its subcategories.`
    if (window.confirm(msg)) deleteCategory(cat.id)
  }

  const renderSection = (title, cats) => {
    if (cats.length === 0) return null
    return (
      <section>
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
        <div className="space-y-2">
          {cats.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              isFirst={idx === 0}
              isLast={idx === cats.length - 1}
              transactions={monthTransactions}
              onEdit={() => openEdit(cat)}
              onDelete={() => handleDelete(cat)}
              onMove={dir => moveCategory(cat.id, dir)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categories</p>
        <button
          onClick={openAdd}
          disabled={readOnly}
          {...readOnlyProps(readOnly, 'Add Category')}
          className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0 ${disabledCls}`}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Category</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {renderSection('Income', incomeCategories)}
      {renderSection('Expenses', expenseCategories)}

      <CategoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editingCategory={editingCategory}
      />
    </div>
  )
}
