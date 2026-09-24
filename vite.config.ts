import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), tailwindcss(), glsl({ minify: process.env.NODE_ENV === 'production' })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
