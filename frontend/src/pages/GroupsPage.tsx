import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError, type Group } from "../lib/api";

export default function GroupsPage() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function loadGroups() {
    try {
      const data = await api.listGroups();
      setGroups(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load groups");
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await api.createGroup(groupName);
      setGroupName("");
      await loadGroups();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      await api.joinGroup(inviteCode);
      setInviteCode("");
      await loadGroups();
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Failed to join group");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Welcome, {user?.name}</h1>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
            Log out
          </button>
        </div>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Your groups</h2>
          {loadError && <p className="text-sm text-red-600 mb-2">{loadError}</p>}
          {groups === null && !loadError && <p className="text-sm text-gray-500">Loading…</p>}
          {groups !== null && groups.length === 0 && (
            <p className="text-sm text-gray-500">
              No groups yet — create one or join with an invite code below.
            </p>
          )}
          {groups !== null && groups.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {groups.map((group) => (
                <li key={group.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link
                      to={`/groups/${group.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {group.name}
                    </Link>
                    <p className="text-xs text-gray-500">Invite code: {group.inviteCode}</p>
                  </div>
                  <Link
                    to={`/groups/${group.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Create a group</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. Apartment 4B"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create group"}
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Join a group</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                placeholder="Invite code"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {joinError && <p className="text-sm text-red-600">{joinError}</p>}
              <button
                type="submit"
                disabled={joining}
                className="w-full rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join group"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
