import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    // jsdom: コンポーネントテストで DOM API を必要とする
    // ユニットテストファイル単位で `// @vitest-environment node` を付けると上書き可
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@wbs-tool/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
