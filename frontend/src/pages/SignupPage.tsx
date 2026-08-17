import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { api, ApiError } from "../lib/api";
import { isNativePlatform, openExternalUrl } from "../lib/nativeBrowser";
import AuthBackdrop from "../components/AuthBackdrop";
import GoogleIcon from "../components/GoogleIcon";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await signup(email, password, name);
      navigate(user.isAdmin ? "/admin" : "/groups");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sign up");
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
        className={`relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 animate-scale-in ${
          shake > 0 ? "animate-shake" : ""
        }`}
      >
        <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Household Ledger
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">Create an account</h1>

        <button
          type="button"
          onClick={() => openExternalUrl(api.googleLoginUrl(isNativePlatform()))}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98]"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border border-gray-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
            />
          </div>
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
          <div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-gray-300 px-4 py-2.5 pr-16 text-sm outline-none transition-all focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-navy-600 hover:text-navy-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1.5 ml-1 text-xs text-gray-500">At least 8 characters.</p>
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
                Creating account…
              </span>
            ) : (
              "Sign up"
            )}
          </button>
        </form>
        <p className="mt-6 text-sm text-gray-600 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-navy-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
