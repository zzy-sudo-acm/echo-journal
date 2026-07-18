import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import type { Theme } from '../store/uiStore'

export async function syncNativeSystemBars(theme: Theme) {
  if (!Capacitor.isNativePlatform()) return

  try {
    await SystemBars.setStyle({
      // Capacitor 8: Dark means light content on a dark background.
      style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    })
  } catch {
    // Appearance remains usable if a platform cannot update system bars.
  }
}
