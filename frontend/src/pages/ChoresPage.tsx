import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, type Chore, type GroupDetail } from "../lib/api";

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];

function currentTurnAssignment(chore: Chore) {
  return chore.assignments.find((a) => a.completedAt === null) ?? null;
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      await api.createChore(groupId, title, frequency);
      setTitle("");
      setFrequency(FREQUENCIES[0]);
      await loadAll();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create chore");
    } finally {
      setCreating(false);
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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
                return (
                  <li key={chore.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{chore.title}</p>
                        <p className="text-xs text-gray-500">{chore.frequency}</p>
                      </div>
                      <button
                        onClick={() => openAssignForm(chore.id)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Assign
                      </button>
                    </div>

                    {turn ? (
                      <div className="mt-2 flex items-center justify-between rounded-md bg-indigo-50 px-3 py-2">
                        <p className="text-xs text-indigo-900">
                          <span className="font-medium">{turn.user?.name ?? "Someone"}</span>'s turn —
                          due {formatDate(turn.dueDate)}
                        </p>
                        <button
                          onClick={() => handleComplete(turn.id)}
                          disabled={completingId === turn.id}
                          className="rounded-md bg-white border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {completingId === turn.id ? "Marking…" : "Mark complete"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400">Not currently assigned.</p>
                    )}

                    {chore.assignments.some((a) => a.completedAt !== null) && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer">
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
                      <form onSubmit={handleAssign} noValidate className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
                          <select
                            value={assignUserId}
                            onChange={(e) => setAssignUserId(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={assigning}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {assigning ? "…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigningChoreId(null)}
                          className="text-sm text-gray-500 hover:text-gray-900"
                        >
                          Cancel
                        </button>
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
