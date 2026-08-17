import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.householdledger.app",
  appName: "Household Ledger",
  webDir: "dist",
  server: {
    url: "https://household-ledger-plum.vercel.app",
    cleartext: false,
  },
};

export default config;
