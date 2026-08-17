import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativePlatform } from "../lib/nativeBrowser";

// Google OAuth and Lemon Squeezy checkout open in the system browser on
// native (see nativeBrowser.ts). The backend redirects back into the app via
// householdledger://auth/callback?token=... — this listener catches that,
// closes the system browser tab, and hands the token to the same route the
// web flow already uses.
export default function NativeDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      const parsed = new URL(url);
      if (parsed.protocol !== "householdledger:") return;

      Browser.close().catch(() => {});

      const token = parsed.searchParams.get("token");
      const error = parsed.searchParams.get("error");
      if (token) {
        navigate(`/auth/google/callback?token=${encodeURIComponent(token)}`, { replace: true });
      } else if (error) {
        navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove());
    };
  }, [navigate]);

  return null;
}
