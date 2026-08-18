import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import AuthBackdrop from "../components/AuthBackdrop";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing its token.");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-navy-50 px-4">
      <AuthBackdrop />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 animate-scale-in">
        <Link to="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Log in
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">Choose a new password</h1>

        {done ? (
          <p className="text-sm text-gray-600 animate-slide-up">
            Password updated. Redirecting you to log in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                New password
              </label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                required
                disabled={!token}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2.5 pr-16 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-navy-600 hover:text-navy-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-400">At least 8 characters.</p>
            {error && <p className="text-sm text-red-600 animate-slide-up">{error}</p>}
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-full bg-navy-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Updating…
                </span>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
