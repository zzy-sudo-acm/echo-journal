import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.zzy.echojournal',
  appName: '回声日记',
  webDir: 'dist',
  server: {
    // Load bundled static files directly — no remote URL
    androidScheme: 'https',
  },
}

export default config
