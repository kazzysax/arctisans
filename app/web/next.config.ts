import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // the X poll cuts long videos with ffmpeg; make sure the binary is deployed with that route
  outputFileTracingIncludes: { "/api/x/poll": ["./node_modules/ffmpeg-static/ffmpeg"] },
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
