/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the project at /<repo-name>/, so production builds
// need that base path. The dev server stays at root. Override with
// BASE_PATH when hosting elsewhere.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? '/trpg-dice-online/' : '/'),
  plugins: [
    react(),
    // PWA: lets the site be installed to the home screen on iOS/Android and
    // launched in standalone (full-screen) mode. The app is P2P (WebRTC) so
    // offline is not useful — the service worker only precaches the shell to
    // make repeat launches feel instant.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'icons/apple-touch-icon-1024.png',
      ],
      manifest: {
        name: 'TRPG Online Dice',
        short_name: 'TRPG Dice',
        description:
          'Online TRPG dice roller with rooms, chat and GM hidden rolls',
        lang: 'ja',
        display: 'standalone',
        orientation: 'any',
        // Matches the default midnight theme's --bg so the splash / status
        // bar blend with the app shell on first paint.
        theme_color: '#14151c',
        background_color: '#14151c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA: any unmatched navigation falls back to the app shell.
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
