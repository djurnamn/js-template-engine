import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/tests/**/*.test.ts', '**/*.test.ts'],
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
        '**/tests/**',
      ],
    },
  },
});