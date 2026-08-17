import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, type Chore, type GroupDetail } from "../lib/api";

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];
const AUTO_ROTATE_FREQUENCIES = new Set(["weekly", "biweekly", "monthly"]);

function currentTurnAssignment(chore: Chore) {
  return chore.assignments.find((a) => a.completedAt === null) ?? null;
}

// The most recently due assignment, whether or not it's been completed —
// used to tell "just completed" apart from "never assigned".
function latestAssignment(chore: Chore) {
  if (chore.assignments.length === 0) return null;
  return [...chore.assignments].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  )[0];
}

const FREQUENCY_PERIOD_LABEL: Record<string, string> = {
  daily: "today",
  weekly: "this week",
  biweekly: "this period",
  monthly: "this month",
};

function periodLabel(frequency: string): string {
  return FREQUENCY_PERIOD_LABEL[frequency] ?? "this period";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChoresPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [chores, setChores] = useState<Chore[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [autoRotate, setAutoRotate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [assigningChoreId, setAssigningChoreId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [completingId, setCompletingId] = useState<string | null>(null);

  async function loadAll() {
    if (!groupId) return;
    try {
      const [g, c] = await Promise.all([api.getGroup(groupId), api.listChores(groupId)]);
      setGroup(g);
      setChores(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load chores");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function handleCreateChore(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setCreateError(null);
    setCreating(true);
    try {
      await api.createChore(groupId, title, frequency, autoRotate && AUTO_ROTATE_FREQUENCIES.has(frequency));
      setTitle("");
      setFrequency(FREQUENCIES[0]);
      setAutoRotate(false);
      await loadAll();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create chore");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleAutoRotate(choreId: string, next: boolean) {
    setTogglingId(choreId);
    try {
      await api.updateChoreAutoRotate(choreId, next);
      await loadAll();
    } catch {
      // reload will reflect the true server state either way
    } finally {
      setTogglingId(null);
    }
  }

  function openAssignForm(choreId: string) {
    setAssigningChoreId(choreId);
    setAssignUserId(group?.members[0]?.userId ?? "");
    setAssignDueDate(new Date().toISOString().slice(0, 10));
    setAssignError(null);
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!assigningChoreId || !assignUserId || !assignDueDate) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await api.assignChore(assigningChoreId, assignUserId, new Date(assignDueDate).toISOString());
      setAssigningChoreId(null);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to assign chore");
    } finally {
      setAssigning(false);
    }
  }

  async function handleComplete(assignmentId: string) {
    setCompletingId(assignmentId);
    try {
      await api.completeChoreAssignment(assignmentId);
      await loadAll();
    } catch {
      // surfaced implicitly via unchanged state; list reload will show current truth
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Chores{group ? ` — ${group.name}` : ""}
        </h1>

        {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Add a chore</h2>
          <form onSubmit={handleCreateChore} noValidate className="space-y-3">
            <input
              type="text"
              placeholder="e.g. Take out trash"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <label
              className={`flex items-center gap-2 text-xs ${
                AUTO_ROTATE_FREQUENCIES.has(frequency) ? "text-gray-700" : "text-gray-400"
              }`}
            >
              <input
                type="checkbox"
                checked={autoRotate}
                disabled={!AUTO_ROTATE_FREQUENCIES.has(frequency)}
                onChange={(e) => setAutoRotate(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-assign to the next person each cycle
              {!AUTO_ROTATE_FREQUENCIES.has(frequency) && " (not available for daily chores)"}
            </label>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-navy-500 active:scale-[0.98] disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add chore"}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All chores</h2>

          {chores === null && !loadError && <p className="text-sm text-gray-500">Loading…</p>}
          {chores !== null && chores.length === 0 && (
            <p className="text-sm text-gray-500">No chores yet — add one above.</p>
          )}

          {chores !== null && chores.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {chores.map((chore) => {
                const turn = currentTurnAssignment(chore);
                const latest = latestAssignment(chore);
                const justCompleted = !turn && latest && latest.completedAt !== null ? latest : null;
                const statusDotColor = turn ? "bg-navy-500" : justCompleted ? "bg-green-500" : "bg-amber-400";
                return (
                  <li
                    key={chore.id}
                    className="py-4 px-2 -mx-2 rounded-md transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor}`}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {chore.title}
                            {chore.autoRotate && (
                              <span
                                className="ml-1.5 text-[10px] font-medium text-navy-700 bg-navy-50 rounded-full px-1.5 py-0.5 align-middle"
                                title="Auto-assigns to the next person each cycle"
                              >
                                ↻ auto
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{chore.frequency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {AUTO_ROTATE_FREQUENCIES.has(chore.frequency) && (
                          <button
                            onClick={() => handleToggleAutoRotate(chore.id, !chore.autoRotate)}
                            disabled={togglingId === chore.id}
                            className="text-xs text-gray-500 transition-colors hover:text-navy-600 disabled:opacity-50"
                          >
                            {togglingId === chore.id
                              ? "…"
                              : chore.autoRotate
                                ? "Turn off auto-assign"
                                : "Turn on auto-assign"}
                          </button>
                        )}
                        <button
                          onClick={() => openAssignForm(chore.id)}
                          className="text-xs text-navy-600 transition-colors hover:text-navy-800 hover:underline"
                        >
                          Assign
                        </button>
                      </div>
                    </div>

                    {turn ? (
                      <div className="mt-2 flex items-center justify-between rounded-md bg-navy-50 px-3 py-2">
                        <p className="text-xs text-navy-900">
                          <span className="font-medium">{turn.user?.name ?? "Someone"}</span>'s turn —
                          due {formatDate(turn.dueDate)}
                        </p>
                        <button
                          onClick={() => handleComplete(turn.id)}
                          disabled={completingId === turn.id}
                          className="rounded-md bg-white border border-navy-300 px-2 py-1 text-xs font-semibold text-navy-700 transition-colors hover:bg-navy-100 disabled:opacity-50"
                        >
                          {completingId === turn.id ? "Marking…" : "Mark complete"}
                        </button>
                      </div>
                    ) : justCompleted ? (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2">
                        <span className="text-green-600" aria-hidden="true">✓</span>
                        <p className="text-xs text-green-800">
                          Done for {periodLabel(chore.frequency)} —{" "}
                          <span className="font-medium">{justCompleted.user?.name ?? "Someone"}</span>{" "}
                          completed it {formatDate(justCompleted.completedAt as string)}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
                        <span className="text-amber-500" aria-hidden="true">●</span>
                        <p className="text-xs text-amber-800">Not currently assigned.</p>
                      </div>
                    )}

                    {chore.assignments.some((a) => a.completedAt !== null) && (
                      <details className="mt-2 group">
                        <summary className="text-xs text-gray-400 cursor-pointer transition-colors hover:text-gray-600">
                          Completion history
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {chore.assignments
                            .filter((a) => a.completedAt !== null)
                            .map((a) => (
                              <li key={a.id} className="text-xs text-gray-500">
                                {a.user?.name ?? "Someone"} completed it on{" "}
                                {formatDate(a.completedAt as string)}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}

                    {assigningChoreId === chore.id && (
                      <form
                        onSubmit={handleAssign}
                        noValidate
                        className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 animate-slide-up"
                      >
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
                          <select
                            value={assignUserId}
                            onChange={(e) => setAssignUserId(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500"
                          >
                            {group?.members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Due date</label>
                          <input
                            type="date"
                            value={assignDueDate}
                            onChange={(e) => setAssignDueDate(e.target.value)}
                            className="w-full sm:w-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={assigning}
                            className="rounded-md bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-navy-500 disabled:opacity-50"
                          >
                            {assigning ? "…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssigningChoreId(null)}
                            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                    {assigningChoreId === chore.id && assignError && (
                      <p className="mt-1 text-sm text-red-600">{assignError}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
