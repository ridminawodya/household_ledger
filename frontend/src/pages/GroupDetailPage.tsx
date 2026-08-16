import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, type GroupDetail } from "../lib/api";
import { downloadMonthlyReportPdf } from "../lib/monthlyReportPdf";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reportMonth, setReportMonth] = useState(currentMonthValue);
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    api
      .getGroup(groupId)
      .then(setGroup)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load group"));
  }, [groupId]);

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
                    <li key={m.id} className="py-2 text-sm text-gray-700">
                      {m.user.name} <span className="text-gray-400">({m.user.email})</span>
                    </li>
                  ))}
                </ul>
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
    </div>
  );
}
