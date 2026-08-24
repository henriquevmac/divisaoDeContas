import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The indicator sits bottom-left, directly on top of the app's bottom nav in
  // a phone viewport. Compile and runtime errors still surface without it.
  // Use `{ position: "top-right" }` instead if you want it back, out of the way.
  devIndicators: false,
};

export default nextConfig;
