import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ApiError } from "../lib/api";
import AuthBackdrop from "../components/AuthBackdrop";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/groups");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log in");
      setShake((s) => s + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-navy-50 px-4">
      <AuthBackdrop />
      <div
        key={shake}
        className={`relative z-10 w-full max-w-sm bg-white rounded-xl shadow-lg p-8 animate-scale-in ${
          shake > 0 ? "animate-shake" : ""
        }`}
      >
        <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Household Ledger
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-2 mb-6">Log in</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
            />
          </div>
          {error && <p className="text-sm text-red-600 animate-slide-up">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-navy-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-navy-500 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Logging in…
              </span>
            ) : (
              "Log in"
            )}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600 text-center">
          No account?{" "}
          <Link to="/signup" className="text-navy-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
