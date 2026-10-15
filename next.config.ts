import type { NextConfig } from "next";

// Static export: the app is plain files served by Firebase Hosting; all logic runs in the browser
// against Firestore, protected by firestore.rules.
const config: NextConfig = { output: "export", images: { unoptimized: true } };
export default config;
