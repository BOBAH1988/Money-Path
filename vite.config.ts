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
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) return 'firebase-auth';
          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore') || id.includes('firebase/app') || id.includes('@firebase/app') || id.includes('@firebase/')) return 'firebase';
          return 'vendor';
        },
      },
    },
  },
  test: { environment: 'jsdom' },
});
