import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/types.ts',
        '**/index.ts',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@js-template-engine/core': resolve(__dirname, './packages/core/src'),
      '@js-template-engine/types': resolve(__dirname, './packages/types/src'),
      '@js-template-engine/extension-react': resolve(__dirname, './packages/extension-react/src'),
      '@js-template-engine/extension-vue': resolve(__dirname, './packages/extension-vue/src'),
      '@js-template-engine/extension-svelte': resolve(__dirname, './packages/extension-svelte/src'),
      '@js-template-engine/extension-bem': resolve(__dirname, './packages/extension-bem/src'),
    },
  },
}); 