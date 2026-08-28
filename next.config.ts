import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes a managed <!-- BEGIN:nextjs-agent-rules -->
  // block into CLAUDE.md on every run. CLAUDE.md is hand-written and is the
  // file agents read; a tool rewriting it each run is not acceptable here.
  agentRules: false,
};

export default nextConfig;
