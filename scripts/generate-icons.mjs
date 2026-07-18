import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const svg = readFileSync('public/icon-512.svg')

// Android icon sizes needed for different densities
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

async function generate() {
  const baseRes = 'android/app/src/main/res'

  // Generate launcher icons (ic_launcher)
  for (const [density, size] of Object.entries(sizes)) {
    const dir = join(baseRes, density)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await sharp(svg).resize(size, size).png().toFile(join(dir, 'ic_launcher.png'))
    console.log(`  ${density}: ${size}x${size}`)
  }

  // Generate foreground icons for adaptive icon
  for (const [density, size] of Object.entries(foregroundSizes)) {
    const dir = join(baseRes, density)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await sharp(svg).resize(size, size).png().toFile(join(dir, 'ic_launcher_foreground.png'))
  }

  console.log('Android icons generated.')
}

generate().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
