import { useAuth } from "../lib/AuthContext";

export default function GroupsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Welcome, {user?.name}</h1>
          <button
            onClick={logout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Log out
          </button>
        </div>
        <p className="text-sm text-gray-500">Group dashboard coming next.</p>
      </div>
    </div>
  );
}
