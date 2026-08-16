import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError, type GroupDetail, type SettleTransaction, type Settlement } from "../lib/api";
import { formatCents } from "../lib/money";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SettleUpPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [transactions, setTransactions] = useState<SettleTransaction[] | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  function load() {
    if (!groupId) return;
    Promise.all([api.getGroup(groupId), api.getSettleUp(groupId), api.listSettlements(groupId)])
      .then(([g, t, h]) => {
        setGroup(g);
        setTransactions(t);
        setHistory(h);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settle-up"));
  }

  useEffect(load, [groupId]);

  function memberName(userId: string): string {
    return group?.members.find((m) => m.userId === userId)?.user.name ?? "Someone";
  }

  async function handleMarkPaid(t: SettleTransaction) {
    if (!groupId) return;
    const key = `${t.fromUserId}-${t.toUserId}`;
    setMarkError(null);
    setMarkingKey(key);
    try {
      await api.recordSettlement(groupId, t.toUserId, t.amountCents);
      load();
    } catch (err) {
      setMarkError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setMarkingKey(null);
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Settle up{group ? ` — ${group.name}` : ""}
        </h1>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <section className="bg-white rounded-lg shadow p-6">
          {transactions === null && !error && <p className="text-sm text-gray-500">Loading…</p>}

          {transactions !== null && transactions.length === 0 && (
            <p className="text-sm text-gray-500">
              Everyone is settled up — no payments needed.
            </p>
          )}

          {transactions !== null && transactions.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-4">
                The minimum number of payments needed to settle all balances in this group.
              </p>
              {markError && <p className="text-sm text-red-600 mb-3">{markError}</p>}
              <ul className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const key = `${t.fromUserId}-${t.toUserId}`;
                  const canMarkPaid = t.fromUserId === user?.id;
                  return (
                    <li key={key} className="py-3 flex items-center justify-between gap-4">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{memberName(t.fromUserId)}</span>{" "}
                        owes{" "}
                        <span className="font-medium">{memberName(t.toUserId)}</span>
                      </p>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCents(t.amountCents)}
                        </p>
                        {canMarkPaid && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(t)}
                            disabled={markingKey === key}
                            className="text-xs font-medium text-navy-600 border border-navy-200 rounded-full px-2.5 py-1 hover:bg-navy-50 disabled:opacity-50"
                          >
                            {markingKey === key ? "Marking…" : "Mark as paid"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {history.length > 0 && (
          <section className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment history</h2>
            <ul className="divide-y divide-gray-100">
              {history.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{s.fromUser.name}</span> paid{" "}
                    <span className="font-medium">{s.toUser.name}</span>
                  </p>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <span className="text-gray-500">{formatDate(s.createdAt)}</span>
                    <span className="font-semibold text-gray-900">{formatCents(s.amountCents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
