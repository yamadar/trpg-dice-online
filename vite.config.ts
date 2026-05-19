/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the project at /<repo-name>/, so production builds
// need that base path. The dev server stays at root. Override with
// BASE_PATH when hosting elsewhere.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? '/trpg-dice-online/' : '/'),
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
