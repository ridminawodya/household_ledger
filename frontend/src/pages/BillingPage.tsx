import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError } from "../lib/api";

export default function BillingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = user?.plan === "premium";

  async function handleUpgrade() {
    setError(null);
    setLoading(true);
    try {
      const { url } = await api.createCheckout();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Billing</h1>
        <p className="text-sm text-gray-500 mb-6">
          Checkout runs through Lemon Squeezy in test mode — no real charge is made.
        </p>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div
            className={`bg-white rounded-lg shadow p-6 border-2 ${
              !isPremium ? "border-navy-500" : "border-transparent"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Free</h2>
              {!isPremium && (
                <span className="text-xs font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5">
                  Current plan
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-gray-900 mb-4">$0</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>1 group</li>
              <li>Up to 4 members per group</li>
              <li>Expenses, settle-up, and chores</li>
            </ul>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-6 border-2 ${
              isPremium ? "border-navy-500" : "border-transparent"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Premium</h2>
              {isPremium && (
                <span className="text-xs font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5">
                  Current plan
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-gray-900 mb-4">$4.99/mo</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>Unlimited groups</li>
              <li>Unlimited members per group</li>
              <li>AI-powered expense parsing</li>
            </ul>
            {isPremium ? (
              <p className="text-xs text-gray-500">
                Manage or cancel your subscription from the receipt email Lemon Squeezy sent you.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
              >
                {loading ? "Redirecting…" : "Upgrade to Premium"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
