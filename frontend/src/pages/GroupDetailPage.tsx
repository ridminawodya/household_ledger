import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError, type GroupDetail, type GroupMember } from "../lib/api";
import { downloadMonthlyReportPdf } from "../lib/monthlyReportPdf";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type PendingAction = { type: "leave" } | { type: "remove"; member: GroupMember };

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reportMonth, setReportMonth] = useState(currentMonthValue);
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    if (!groupId) return;
    api
      .getGroup(groupId)
      .then(setGroup)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load group"));
  }

  useEffect(load, [groupId]);

  async function handleDownloadReport() {
    if (!groupId) return;
    setReportError(null);
    setGenerating(true);
    try {
      const report = await api.getMonthlyReport(groupId, reportMonth);
      downloadMonthlyReportPdf(report);
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmAction() {
    if (!groupId || !pendingAction) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (pendingAction.type === "leave") {
        await api.leaveGroup(groupId);
        navigate("/groups", { replace: true });
        return;
      }
      await api.removeMember(groupId, pendingAction.member.userId);
      setPendingAction(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete this action");
    } finally {
      setActionLoading(false);
    }
  }

  const isCreator = group !== null && group.createdById === user?.id;

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {group === null && !error && <p className="text-sm text-gray-500">Loading…</p>}

        {group && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{group.name}</h1>
              <p className="text-sm text-gray-500 mb-4">Invite code: {group.inviteCode}</p>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Members</h2>
                <ul className="divide-y divide-gray-100">
                  {group.members.map((m) => (
                    <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-700 min-w-0 truncate">
                        {m.user.name} <span className="text-gray-400">({m.user.email})</span>
                        {m.userId === group.createdById && (
                          <span className="ml-1.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5 align-middle">
                            creator
                          </span>
                        )}
                      </p>
                      {isCreator && m.userId !== group.createdById && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setPendingAction({ type: "remove", member: m });
                          }}
                          className="text-xs font-medium text-red-600 shrink-0 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {!isCreator && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setPendingAction({ type: "leave" });
                    }}
                    className="mt-4 text-xs font-medium text-red-600 hover:underline"
                  >
                    Leave group
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Monthly report</h2>
              <p className="text-xs text-gray-500 mb-3">
                Download a PDF of all expenses, payments, and completed chores for a given month.
              </p>
              {reportError && <p className="text-sm text-red-600 mb-3">{reportError}</p>}
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={generating}
                  className="rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {pendingAction.type === "leave" ? "Leave this group?" : `Remove ${pendingAction.member.user.name}?`}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {pendingAction.type === "leave"
                ? "You'll lose access to this group's expenses, chores, and settle-up history. This can't be undone."
                : `${pendingAction.member.user.name} will lose access to this group. This can't be undone.`}
              {" "}If there's an unsettled balance, this will be blocked until it's settled up.
            </p>

            {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={actionLoading}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoading ? "Working…" : pendingAction.type === "leave" ? "Leave group" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
