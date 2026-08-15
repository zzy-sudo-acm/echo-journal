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

// Web PWA icons. Chrome needs raster PNGs for reliable installability, and
// iOS ignores manifest icons entirely — it reads apple-touch-icon instead.
// The maskable/apple variants are flattened onto the icon background so the
// artwork stays centered and opaque in every host mask.
const webIcons = {
  'public/icon-192.png': { size: 192, flatten: false },
  'public/icon-512.png': { size: 512, flatten: false },
  'public/icon-maskable-512.png': { size: 512, flatten: true },
  'public/apple-touch-icon.png': { size: 180, flatten: true },
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

  // Generate web/PWA raster icons
  for (const [path, { size, flatten }] of Object.entries(webIcons)) {
    const pipeline = flatten
      ? sharp(svg).resize(size, size).flatten({ background: '#11110F' })
      : sharp(svg).resize(size, size)
    await pipeline.png().toFile(path)
    console.log(`  ${path}: ${size}x${size}${flatten ? ' (flattened)' : ''}`)
  }

  console.log('Android icons generated.')
}

generate().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
