import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({ plugins: [react()], test: { include: ['tests/**/*.test.ts'] }, resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, clearScreen: false, server: { port: 1420, strictPort: true }, envPrefix: ['VITE_'], build: { target: 'es2021' } });
