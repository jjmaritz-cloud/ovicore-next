import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "au.com.ovicore.mobile",
  appName: "OviCore",
  webDir: "www",

  server: {
    url: "https://sandbox.ovicore.com.au/mobile",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;