import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError, type GroupDetail, type SettleTransaction, type Settlement } from "../lib/api";
import { formatCents } from "../lib/money";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: "owed" | "paid" }) {
  const styles =
    status === "owed"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-green-50 text-green-700 border-green-200";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${styles}`}>
      {status === "owed" ? "Owed" : "Paid"}
    </span>
  );
}

export default function SettleUpPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [transactions, setTransactions] = useState<SettleTransaction[] | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pendingPayment, setPendingPayment] = useState<SettleTransaction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [justPaidKey, setJustPaidKey] = useState<string | null>(null);

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

  function openConfirm(t: SettleTransaction) {
    setConfirmError(null);
    setPendingPayment(t);
  }

  async function handleConfirmPayment() {
    if (!groupId || !pendingPayment) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await api.recordSettlement(groupId, pendingPayment.toUserId, pendingPayment.amountCents);
      setJustPaidKey(`${pendingPayment.fromUserId}-${pendingPayment.toUserId}`);
      setPendingPayment(null);
      load();
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setConfirming(false);
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
              <ul className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const key = `${t.fromUserId}-${t.toUserId}`;
                  const canPay = t.fromUserId === user?.id;
                  const justPaid = justPaidKey === key;
                  return (
                    <li
                      key={key}
                      className={`py-3 px-2 -mx-2 rounded-md flex items-center justify-between gap-4 transition-colors ${
                        justPaid ? "bg-green-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={justPaid ? "paid" : "owed"} />
                        <p className="text-sm text-gray-900 truncate">
                          <span className="font-medium">{memberName(t.fromUserId)}</span>{" "}
                          owes{" "}
                          <span className="font-medium">{memberName(t.toUserId)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCents(t.amountCents)}
                        </p>
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => openConfirm(t)}
                            disabled={justPaid}
                            className={`text-xs font-medium rounded-full px-3 py-1.5 transition-all active:scale-[0.97] disabled:opacity-70 ${
                              justPaid
                                ? "text-green-700 bg-green-100"
                                : "text-white bg-navy-600 hover:bg-navy-500"
                            }`}
                          >
                            {justPaid ? "Paid ✓" : "Pay now"}
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
                <li
                  key={s.id}
                  className="py-2.5 px-2 -mx-2 rounded-md flex items-center justify-between gap-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge status="paid" />
                    <p className="text-sm text-gray-900 truncate">
                      <span className="font-medium">{s.fromUser.name}</span> paid{" "}
                      <span className="font-medium">{s.toUser.name}</span>
                    </p>
                  </div>
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

      {pendingPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 animate-scale-in">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Confirm payment</h2>
            <p className="text-xs text-gray-500 mb-5">
              This records that you paid {memberName(pendingPayment.toUserId)} outside the app
              (cash, bank transfer, etc.) — it doesn't move money through Household Ledger.
            </p>

            <div className="rounded-md bg-gray-50 p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">From</span>
                <span className="font-medium text-gray-900">{memberName(pendingPayment.fromUserId)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">To</span>
                <span className="font-medium text-gray-900">{memberName(pendingPayment.toUserId)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">{formatCents(pendingPayment.amountCents)}</span>
              </div>
            </div>

            {confirmError && <p className="text-sm text-red-600 mb-4">{confirmError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingPayment(null)}
                disabled={confirming}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="flex-1 rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-navy-500 active:scale-[0.98] disabled:opacity-50"
              >
                {confirming ? "Confirming…" : "Confirm payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
