import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iOS app loads the live site. Next.js, the database, and sign-in stay on the server.
 * Change `server.url` only when the production address changes.
 */
const config: CapacitorConfig = {
  appId: "com.entilaka.moodle",
  appName: "Entilaka",
  webDir: "mobile/www",
  server: {
    url: "https://moodle-nine-wheat.vercel.app/login",
    cleartext: false,
    allowNavigation: ["moodle-nine-wheat.vercel.app", "*.vercel.app"],
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
    appendUserAgent: "EntilakaNativeApp Capacitor",
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: "#0F172A",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0F172A",
    },
  },
};

export default config;
