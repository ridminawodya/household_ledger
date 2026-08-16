import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function GoogleCallbackPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setError("No sign-in token was returned by Google.");
      return;
    }

    loginWithToken(token)
      .then((user) => navigate(user.isAdmin ? "/admin" : "/groups", { replace: true }))
      .catch(() => setError("Failed to complete Google sign-in."));
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <Link to="/login" className="text-sm text-navy-600 hover:underline">
              Back to log in
            </Link>
          </>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-navy-600" />
            Finishing sign-in…
          </div>
        )}
      </div>
    </div>
  );
}
