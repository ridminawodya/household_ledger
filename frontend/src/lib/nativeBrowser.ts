import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// Google blocks its OAuth flow inside generic embedded WebViews, and Lemon
// Squeezy's checkout needs a real browser context. Route both through the
// system browser (Chrome Custom Tabs on Android) when running as a native
// app; a plain redirect is fine in an actual browser tab.
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}
