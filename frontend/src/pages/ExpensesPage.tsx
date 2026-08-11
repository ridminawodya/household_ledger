import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Expense, type GroupDetail, type ParsedExpense } from "../lib/api";
import { centsToDollarsInput, dollarsToCents, formatCents } from "../lib/money";

const CATEGORIES = ["groceries", "food", "utilities", "rent", "transport", "other"];

export default function ExpensesPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Manual add form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // AI free-text form
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ParsedExpense | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  async function loadAll() {
    if (!groupId) return;
    try {
      const [g, e] = await Promise.all([api.getGroup(groupId), api.listExpenses(groupId)]);
      setGroup(g);
      setExpenses(e);
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
      await api.createExpense(groupId, description, cents, category);
      setDescription("");
      setAmount("");
      setCategory(CATEGORIES[0]);
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
    setAiResult(null);
    setAiLoading(true);
    try {
      const parsed = await api.parseExpense(groupId, aiText);
      setAiResult(parsed);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : "Failed to parse expense");
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
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {groupId && (
          <Link to={`/groups/${groupId}`} className="text-sm text-indigo-600 hover:underline">
            ← Back to {group?.name ?? "group"}
          </Link>
        )}

        <h1 className="text-xl font-semibold text-gray-900 mt-4 mb-6">Expenses</h1>

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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {aiError && <p className="text-sm text-red-600">{aiError}</p>}
            <button
              type="submit"
              disabled={aiLoading}
              className="rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              {aiLoading ? "Parsing…" : "Parse with AI"}
            </button>
          </form>

          {aiResult && (
            <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-medium text-indigo-900 mb-3">
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
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <button
              type="submit"
              disabled={adding}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add expense"}
            </button>
          </form>
        </section>

        {/* Expense list */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All expenses</h2>
          {expenses === null && !loadError && <p className="text-sm text-gray-500">Loading…</p>}
          {expenses !== null && expenses.length === 0 && (
            <p className="text-sm text-gray-500">No expenses yet — add your first one above.</p>
          )}
          {expenses !== null && expenses.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <li key={expense.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                    <p className="text-xs text-gray-500">
                      {expense.category} · paid by {expense.paidBy?.name ?? memberName(expense.paidById)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCents(expense.amountCents)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
