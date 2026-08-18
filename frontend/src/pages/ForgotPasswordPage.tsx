import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import AuthBackdrop from "../components/AuthBackdrop";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send reset link");
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
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-2">Reset your password</h1>

        {sent ? (
          <p className="text-sm text-gray-600 animate-slide-up">
            If an account exists for <span className="font-medium text-gray-900">{email}</span>, we've sent
            a link to reset your password. It expires in 1 hour.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and we'll send you a link to choose a new password.
            </p>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-gray-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                />
              </div>
              {error && <p className="text-sm text-red-600 animate-slide-up">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-navy-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Sending…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
