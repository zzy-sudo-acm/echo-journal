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
              includeAssets: [
                'favicon.svg',
                'icon-192.png',
                'icon-512.png',
                'icon-maskable-512.png',
                'apple-touch-icon.png',
              ],
              manifest: {
                name: '回声日记',
                short_name: '回声日记',
                description: '私人日记 — 本地优先、随时记录、安全备份',
                lang: 'zh-CN',
                theme_color: '#071927',
                background_color: '#071927',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/echo-journal/',
                scope: '/echo-journal/',
                icons: [
                  {
                    src: '/echo-journal/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: '/echo-journal/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                  {
                    src: '/echo-journal/icon-maskable-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
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
