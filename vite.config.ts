import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// In dev, Vite versucht /api/* als Module zu transformieren, was esbuild
// mit "Invalid loader value" abbrechen lässt. Wir kappen /api/* Requests
// im Dev-Server (in Produktion übernehmen die Vercel Functions).
const blockApiDev = {
  name: "block-api-in-dev",
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith("/api/")) {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "API not available in dev preview" }));
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [
    blockApiDev,
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
