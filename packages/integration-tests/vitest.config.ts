import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.integration.test.ts',
      '__tests__/**/*.integration.test.ts',
      '*.integration.test.ts',
    ],
  },
}); 