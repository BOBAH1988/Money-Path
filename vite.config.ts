import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Money-Path/',
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  test: { environment: 'jsdom' },
});
