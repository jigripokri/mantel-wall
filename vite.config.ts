import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

/**
 * Serves `./dev-photos` at `/dev-photos`, during `vite dev` ONLY.
 *
 * Deliberately not `public/`: Vite copies that directory into `dist/` verbatim,
 * so a family photo placed there would be published to a world-readable URL by
 * any local `vercel deploy` — `/tv` has no auth until v2. `apply: "serve"` means
 * this plugin does not exist during a build, so there is no path by which these
 * files can reach a deploy. Real photos live in Supabase Storage behind a signed
 * URL; this is only for judging the 5B design against a real image.
 */
function devPhotos(): Plugin {
  const root = path.resolve(import.meta.dirname, "dev-photos");
  const MIME: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
  };
  return {
    name: "mantel-dev-photos",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/dev-photos", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
        const file = path.resolve(root, rel);
        // Contain to the directory — a crafted `..` must not read the repo.
        if (!file.startsWith(root + path.sep)) return next();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        const mime = MIME[path.extname(file).toLowerCase()];
        if (!mime) return next();
        res.setHeader("content-type", mime);
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devPhotos()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port: 5000,
    host: true,
  },
  preview: {
    port: 5000,
    host: true,
  },
});
