import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], optimizeDeps: { include: ['@huggingface/kernels'] }, worker: { format: 'es' }, server: { proxy: { '/api/neural': { target: 'http://127.0.0.1:8001', ws: true } } }, build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } } });
