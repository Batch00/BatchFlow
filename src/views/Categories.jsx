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
import CategoryModal from '../components/categories/CategoryModal'

// ── SortableSubcategoryRow ────────────────────────────────────────────────────

function SortableSubcategoryRow({ categoryId, sub, transactionCount }) {
  const { updateSubcategory, deleteSubcategory } = useApp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(sub.name)

  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: sub.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const startEdit = () => { setValue(sub.name); setEditing(true) }

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
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical size={13} />
      </button>

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
            className="flex-1 text-sm text-slate-700 dark:text-slate-200 border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700"
          />
          <button onClick={commit} className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors" title="Save">
            <Check size={13} />
          </button>
          <button onClick={() => { setValue(sub.name); setEditing(false) }} className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors" title="Cancel">
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <span
            className="flex-1 text-sm text-slate-700 dark:text-slate-300 cursor-default select-none"
            onDoubleClick={startEdit}
            title="Double-click to rename"
          >{sub.name}</span>
          {transactionCount > 0 && (
            <span className="text-xs text-slate-400">{transactionCount}</span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
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
        className="flex-1 text-sm border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
      />
      <button onClick={commit} className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors" title="Add">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors" title="Cancel">
        <X size={14} />
      </button>
    </div>
  )
}

// ── CategoryCard ───────────────────────────────────────────────────────────────

function CategoryCard({ category, isFirst, isLast, transactions, onEdit, onDelete, onMove }) {
  const { addSubcategory, moveSubcategory, updateCategory } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [addingSubcat, setAddingSubcat] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameValue, setNameValue] = useState(category.name)

  const startNameEdit = () => { setNameValue(category.name); setNameEditing(true) }

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleSubcatDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      moveSubcategory(category.id, active.id, over.id)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Category header row */}
      <div className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />

        {nameEditing ? (
          // Inline name edit — replaces the expand button while active
          <>
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleNameKeyDown}
              autoFocus
              className="flex-1 text-sm font-semibold border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 min-w-0 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onMouseDown={e => e.preventDefault()} // keep focus on input
              onClick={commitName}
              className="p-1 rounded text-indigo-600 hover:bg-indigo-50 flex-shrink-0 transition-colors"
              title="Save"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setNameValue(category.name); setNameEditing(false) }}
              className="p-1 rounded text-slate-400 hover:bg-slate-100 flex-shrink-0 transition-colors"
              title="Cancel"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate cursor-default select-none"
              onDoubleClick={e => { e.stopPropagation(); startNameEdit() }}
              title="Double-click to rename"
            >
              {category.name}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${
              isIncome ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {category.type}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
              {category.subcategories.length} sub{category.subcategories.length !== 1 ? 's' : ''}
            </span>
            {catTransactionCount > 0 && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                · {catTransactionCount} txn{catTransactionCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="ml-auto flex-shrink-0">
              {expanded
                ? <ChevronDown size={14} className="text-slate-400" />
                : <ChevronRight size={14} className="text-slate-400" />
              }
            </span>
          </button>
        )}

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onMove('up')}
            disabled={isFirst}
            title="Move up"
            className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={isLast}
            title="Move down"
            className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown size={13} />
          </button>
          <button
            onClick={onEdit}
            title="Edit category"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            title="Delete category"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
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
                />
              ))}
            </SortableContext>
          </DndContext>

          {addingSubcat ? (
            <AddSubcategoryInput
              onAdd={name => { addSubcategory(category.id, name); setAddingSubcat(false) }}
              onCancel={() => setAddingSubcat(false)}
            />
          ) : (
            <button
              onClick={() => setAddingSubcat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 w-full text-left text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors mt-1"
            >
              <Plus size={12} />
              Add subcategory
            </button>
          )}
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

  const openAdd = () => { setEditingCategory(null); setModalOpen(true) }
  const openEdit = (cat) => { setEditingCategory(cat); setModalOpen(true) }

  const handleSave = (data) => {
    if (editingCategory) updateCategory(editingCategory.id, data)
    else addCategory(data)
  }

  const handleDelete = (cat) => {
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
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categories</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Category
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
