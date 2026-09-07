import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3001";
  const agentTarget = env.VITE_AGENT_PROXY_TARGET || "http://127.0.0.1:8080";
  const auditReservationTarget =
    env.VITE_AUDIT_RESERVATION_PROXY_TARGET || "http://127.0.0.1:3000";
  const recommendationTarget =
    env.VITE_RECOMMENDATION_PROXY_TARGET || "http://127.0.0.1:8082";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "^/audit-demo/reservation/login$": {
          target: auditReservationTarget,
          changeOrigin: true,
          rewrite: () => "/demo/auth/login",
        },
        "^/audit-demo/agent/login$": {
          target: agentTarget,
          changeOrigin: true,
          rewrite: () => "/demo/auth/login",
        },
        "^/audit-demo/recommendation/login$": {
          target: recommendationTarget,
          changeOrigin: true,
          rewrite: () => "/demo/auth/login",
        },
        "/graphql": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/api/v1/demo": {
          target: agentTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
