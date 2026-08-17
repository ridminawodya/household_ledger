import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  api,
  ApiError,
  type Expense,
  type GroupCategory,
  type GroupDetail,
  type ParsedExpense,
  type RecurrenceFrequency,
} from "../lib/api";
import { centsToDollarsInput, dollarsToCents, formatCents } from "../lib/money";

const FALLBACK_CATEGORIES = ["groceries", "food", "utilities", "rent", "transport", "other"];
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | ""; label: string }[] = [
  { value: "", label: "Doesn't repeat" },
  { value: "weekly", label: "Repeats weekly" },
  { value: "biweekly", label: "Repeats every 2 weeks" },
  { value: "monthly", label: "Repeats monthly" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ExpensesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  const categoryNames = categories.length > 0 ? categories.map((c) => c.name) : FALLBACK_CATEGORIES;

  // Manual add form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | "">("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // AI free-text form
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIsPlanLimit, setAiIsPlanLimit] = useState(false);
  const [aiResult, setAiResult] = useState<ParsedExpense | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  async function loadAll() {
    if (!groupId) return;
    try {
      const [g, e, cats] = await Promise.all([
        api.getGroup(groupId),
        api.listExpenses(groupId),
        api.listCategories(groupId),
      ]);
      setGroup(g);
      setExpenses(e);
      setViewingExpense((prev) => (prev ? e.find((x) => x.id === prev.id) ?? null : null));
      setCategories(cats);
      setCategory((prev) => prev || cats[0]?.name || FALLBACK_CATEGORIES[0]);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load expenses");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  function memberName(userId: string): string {
    return group?.members.find((m) => m.userId === userId)?.user.name ?? "Someone";
  }

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setAddError(null);

    const cents = dollarsToCents(amount);
    if (cents === null) {
      setAddError("Enter a valid positive amount");
      return;
    }

    setAdding(true);
    try {
      await api.createExpense(groupId, description, cents, category, recurrence || undefined);
      setDescription("");
      setAmount("");
      setCategory(categoryNames[0]);
      setRecurrence("");
      await loadAll();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to add expense");
    } finally {
      setAdding(false);
    }
  }

  async function handleParse(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setAiError(null);
    setAiIsPlanLimit(false);
    setAiResult(null);
    setAiLoading(true);
    try {
      const parsed = await api.parseExpense(groupId, aiText);
      setAiResult(parsed);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : "Failed to parse expense");
      setAiIsPlanLimit(err instanceof ApiError && err.code === "PLAN_LIMIT_AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleConfirmAiExpense() {
    if (!groupId || !aiResult) return;
    setAiSaving(true);
    setAiError(null);
    try {
      await api.createExpense(groupId, aiResult.description, aiResult.amountCents, aiResult.category);
      setAiResult(null);
      setAiText("");
      await loadAll();
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : "Failed to save expense");
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Expenses{group ? ` — ${group.name}` : ""}
        </h1>

        {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

        {/* AI free-text entry */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Add with AI</h2>
          <p className="text-xs text-gray-500 mb-3">
            Describe the expense in plain English, e.g. "paid $85 for groceries and pizza last night".
          </p>
          <form onSubmit={handleParse} className="space-y-3">
            <textarea
              rows={2}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="paid $85 for groceries and pizza last night"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
            {aiError && (
              <p className="text-sm text-red-600">
                {aiError}
                {aiIsPlanLimit && (
                  <>
                    {" "}
                    <Link to="/billing" className="underline hover:no-underline">
                      Upgrade
                    </Link>
                  </>
                )}
              </p>
            )}
            <button
              type="submit"
              disabled={aiLoading}
              className="rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              {aiLoading ? "Parsing…" : "Parse with AI"}
            </button>
          </form>

          {aiResult && (
            <div className="mt-4 rounded-md border border-navy-200 bg-navy-50 p-4">
              <p className="text-xs font-medium text-navy-900 mb-3">
                Review before saving — nothing is written until you confirm.
              </p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={aiResult.description}
                    onChange={(e) => setAiResult({ ...aiResult, description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={centsToDollarsInput(aiResult.amountCents)}
                      onChange={(e) => {
                        const cents = dollarsToCents(e.target.value);
                        if (cents !== null) setAiResult({ ...aiResult, amountCents: cents });
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={aiResult.category}
                      onChange={(e) => setAiResult({ ...aiResult, category: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConfirmAiExpense}
                  disabled={aiSaving}
                  className="rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
                >
                  {aiSaving ? "Saving…" : "Confirm & save"}
                </button>
                <button
                  onClick={() => setAiResult(null)}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Manual add form */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Add manually</h2>
          <form onSubmit={handleAddExpense} noValidate className="space-y-3">
            <input
              type="text"
              placeholder="Description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount ($)"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              >
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency | "")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <button
              type="submit"
              disabled={adding}
              className="w-full rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add expense"}
            </button>
          </form>
        </section>

        {/* Expense list */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All expenses</h2>

          {expenses !== null && expenses.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500"
              >
                <option value="">All categories</option>
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500"
              >
                <option value="">Anyone</option>
                {group?.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                title="From date"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                title="To date"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              {(filterCategory || filterMember || filterFrom || filterTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("");
                    setFilterMember("");
                    setFilterFrom("");
                    setFilterTo("");
                  }}
                  className="col-span-2 sm:col-span-4 text-xs text-navy-600 hover:underline text-left"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {expenses === null && !loadError && <p className="text-sm text-gray-500">Loading…</p>}
          {expenses !== null && expenses.length === 0 && (
            <p className="text-sm text-gray-500">No expenses yet — add your first one above.</p>
          )}
          {(() => {
            if (expenses === null || expenses.length === 0) return null;
            const filtered = expenses.filter((e) => {
              if (filterCategory && e.category !== filterCategory) return false;
              if (filterMember && e.paidById !== filterMember) return false;
              if (filterFrom && e.createdAt.slice(0, 10) < filterFrom) return false;
              if (filterTo && e.createdAt.slice(0, 10) > filterTo) return false;
              return true;
            });
            if (filtered.length === 0) {
              return <p className="text-sm text-gray-500">No expenses match these filters.</p>;
            }
            return (
              <ul className="divide-y divide-gray-100">
                {filtered.map((expense) => (
                <li key={expense.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {expense.description}
                      {expense.recurrenceFrequency && (
                        <span
                          className="ml-1.5 text-[10px] font-medium text-navy-700 bg-navy-50 rounded-full px-1.5 py-0.5 align-middle"
                          title={`Repeats ${expense.recurrenceFrequency}`}
                        >
                          ↻
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {expense.category} · paid by {expense.paidBy?.name ?? memberName(expense.paidById)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatCents(expense.amountCents)}</p>
                    <button
                      type="button"
                      onClick={() => setViewingExpense(expense)}
                      className="text-xs font-medium text-navy-600 border border-navy-200 rounded-full px-2.5 py-1 hover:bg-navy-50"
                    >
                      View
                    </button>
                  </div>
                </li>
                ))}
              </ul>
            );
          })()}
        </section>
      </div>

      {viewingExpense && (
        <ExpenseDetailModal
          expense={viewingExpense}
          memberName={memberName}
          canManage={viewingExpense.paidById === user?.id}
          categoryNames={categoryNames}
          onClose={() => setViewingExpense(null)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}

function ExpenseDetailModal({
  expense,
  memberName,
  canManage,
  categoryNames,
  onClose,
  onChanged,
}: {
  expense: Expense;
  memberName: (userId: string) => string;
  canManage: boolean;
  categoryNames: string[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(expense.description);
  const [editAmount, setEditAmount] = useState(centsToDollarsInput(expense.amountCents));
  const [editCategory, setEditCategory] = useState(expense.category);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditDescription(expense.description);
    setEditAmount(centsToDollarsInput(expense.amountCents));
    setEditCategory(expense.category);
    setActionError(null);
    setEditing(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    const cents = dollarsToCents(editAmount);
    if (cents === null) {
      setActionError("Enter a valid positive amount");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await api.updateExpense(expense.id, {
        description: editDescription,
        amountCents: cents,
        category: editCategory,
      });
      setEditing(false);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteExpense(expense.id);
      onClose();
      await onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete expense");
      setDeleting(false);
    }
  }

  async function handleReceiptSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    setActionError(null);
    try {
      await api.uploadReceipt(expense.id, file);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to upload receipt");
    } finally {
      setUploadingReceipt(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{expense.description}</h2>
                <p className="text-xs text-gray-500">{formatDateTime(expense.createdAt)}</p>
              </div>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="rounded-md bg-gray-50 p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-gray-900 capitalize">{expense.category}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paid by</span>
                <span className="font-medium text-gray-900">
                  {expense.paidBy?.name ?? memberName(expense.paidById)}
                </span>
              </div>
              {expense.recurrenceFrequency && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Repeats</span>
                  <span className="font-medium text-gray-900 capitalize">{expense.recurrenceFrequency}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">{formatCents(expense.amountCents)}</span>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-700 mb-2">Split</h3>
            <ul className="divide-y divide-gray-100 mb-4">
              {expense.shares.map((share) => (
                <li key={share.id} className="py-1.5 flex justify-between text-sm">
                  <span className="text-gray-700">{memberName(share.userId)}</span>
                  <span className="text-gray-900">{formatCents(share.amountCents)}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-xs font-semibold text-gray-700 mb-2">Receipt</h3>
            {expense.receiptUrl ? (
              <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="block mb-4">
                <img
                  src={expense.receiptUrl}
                  alt="Receipt"
                  className="w-full rounded-md border border-gray-200 max-h-48 object-cover"
                />
              </a>
            ) : (
              <p className="text-xs text-gray-400 mb-3">No receipt attached.</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptSelected}
              className="hidden"
              id="receipt-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingReceipt}
              className="w-full mb-4 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadingReceipt ? "Uploading…" : expense.receiptUrl ? "Replace receipt" : "Add receipt photo"}
            </button>

            {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}

            {canManage && (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Edit expense</h2>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
