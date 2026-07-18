import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android'
  const base = isAndroid ? './' : '/echo-journal/'

  return {
    plugins: [
      react(),
      // PWA only for web build; Capacitor handles offline for Android
      ...(isAndroid
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
              manifest: {
                name: '回声日记',
                short_name: '回声日记',
                description: '私人日记 — 本地优先、随时记录、安全备份',
                theme_color: '#11110F',
                background_color: '#11110F',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/echo-journal/',
                scope: '/echo-journal/',
                icons: [
                  {
                    src: '/echo-journal/icon-192.svg',
                    sizes: '192x192',
                    type: 'image/svg+xml',
                  },
                  {
                    src: '/echo-journal/icon-512.svg',
                    sizes: '512x512',
                    type: 'image/svg+xml',
                  },
                  {
                    src: '/echo-journal/icon-512.svg',
                    sizes: '512x512',
                    type: 'image/svg+xml',
                    purpose: 'any maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,woff2}'],
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                runtimeCaching: [
                  {
                    urlPattern: ({ request }) => request.destination === 'font',
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'echo-journal-fonts-v2',
                      expiration: {
                        maxEntries: 12,
                        maxAgeSeconds: 60 * 60 * 24 * 365,
                      },
                    },
                  },
                ],
              },
            }),
          ]),
    ],
    base,
    build: {
      // Keep every font as a hashed asset instead of inlining small previews.
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})
