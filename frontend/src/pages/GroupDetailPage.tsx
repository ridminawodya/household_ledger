import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type GroupDetail } from "../lib/api";

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    api
      .getGroup(groupId)
      .then(setGroup)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load group"));
  }, [groupId]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/groups" className="text-sm text-indigo-600 hover:underline">
          ← Back to groups
        </Link>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {group && (
          <div className="mt-4">
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

            <p className="mt-6 text-sm text-gray-500">
              Expenses, settle-up, and chores views coming next.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
