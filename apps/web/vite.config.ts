import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wbs-tool/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 既定は開発用 API（5174）。E2E は VITE_API_PORT でテスト用 API へ向ける。
      '/api': `http://localhost:${process.env.VITE_API_PORT ?? '5174'}`,
    },
  },
});
