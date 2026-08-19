import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Safety net: allow any host (e.g. your Render subdomain) to reach the
      // Vite dev middleware. Production should serve static files instead
      // (see server.ts), but this prevents "Blocked request" errors if the
      // app ever falls back to dev mode.
      allowedHosts: true as true,
    },
  };
});
