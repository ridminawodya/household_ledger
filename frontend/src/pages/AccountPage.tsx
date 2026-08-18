import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError } from "../lib/api";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Account</h1>
          <p className="text-sm text-gray-500">Manage your Household Ledger account.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900">{user?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Plan</dt>
              <dd className="text-gray-900 capitalize">{user?.plan}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-red-100">
          <h2 className="text-sm font-semibold text-red-700 mb-1">Danger zone</h2>
          <p className="text-xs text-gray-500 mb-3">
            Permanently deletes your account. You must first delete or transfer any groups you created,
            and settle any outstanding balances in groups you belong to.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Delete account
          </button>
        </div>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 animate-scale-in">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete your account?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This permanently deletes your account and removes you from every group you're a member of.
              This can't be undone.
            </p>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
