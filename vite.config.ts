
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'esnext'
  },
  server: {
    port: 3000
  },
  define: {
    // We use a dynamic lookup to ensure the API key can be updated at runtime 
    // by the environment (AI Studio/Netlify) without requiring a re-build.
    'process.env.API_KEY': 'globalThis.process?.env?.API_KEY || ""'
  }
});
