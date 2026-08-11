import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type GroupDetail, type SettleTransaction } from "../lib/api";
import { formatCents } from "../lib/money";

export default function SettleUpPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [transactions, setTransactions] = useState<SettleTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    Promise.all([api.getGroup(groupId), api.getSettleUp(groupId)])
      .then(([g, t]) => {
        setGroup(g);
        setTransactions(t);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settle-up"));
  }, [groupId]);

  function memberName(userId: string): string {
    return group?.members.find((m) => m.userId === userId)?.user.name ?? "Someone";
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {groupId && (
          <Link to={`/groups/${groupId}`} className="text-sm text-indigo-600 hover:underline">
            ← Back to {group?.name ?? "group"}
          </Link>
        )}

        <h1 className="text-xl font-semibold text-gray-900 mt-4 mb-6">Settle up</h1>

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
              <ul className="divide-y divide-gray-100">
                {transactions.map((t, i) => (
                  <li key={i} className="py-3 flex items-center justify-between">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{memberName(t.fromUserId)}</span>{" "}
                      owes{" "}
                      <span className="font-medium">{memberName(t.toUserId)}</span>
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCents(t.amountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
