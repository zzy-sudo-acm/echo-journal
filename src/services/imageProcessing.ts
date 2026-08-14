export const MAX_IMAGE_EDGE = 2560
export const DEFAULT_IMAGE_CONCURRENCY = 3

const MAX_IMAGE_CONCURRENCY = 8
const LOSSY_IMAGE_QUALITY = 0.88

export interface ProcessedImage {
  blob: Blob
  mimeType: string
  width: number
  height: number
  fileName?: string
}

type AsyncMapper<T, R> = (item: T, index: number) => Promise<R> | R

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

export function mapWithConcurrency<T, R>(
  items: readonly T[],
  mapper: AsyncMapper<T, R>,
  concurrency?: number,
): Promise<R[]>
export function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: AsyncMapper<T, R>,
): Promise<R[]>
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  mapperOrConcurrency: AsyncMapper<T, R> | number,
  concurrencyOrMapper: number | AsyncMapper<T, R> = DEFAULT_IMAGE_CONCURRENCY,
): Promise<R[]> {
  const mapper =
    typeof mapperOrConcurrency === 'function'
      ? mapperOrConcurrency
      : (concurrencyOrMapper as AsyncMapper<T, R>)
  const requestedConcurrency =
    typeof mapperOrConcurrency === 'number'
      ? mapperOrConcurrency
      : typeof concurrencyOrMapper === 'number'
        ? concurrencyOrMapper
        : DEFAULT_IMAGE_CONCURRENCY

  if (typeof mapper !== 'function') throw new TypeError('mapWithConcurrency requires a mapper')
  if (items.length === 0) return []

  const limit = Math.min(
    items.length,
    MAX_IMAGE_CONCURRENCY,
    Math.max(1, Number.isFinite(requestedConcurrency) ? Math.floor(requestedConcurrency) : 1),
  )
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

function inferMimeType(file: File): string {
  const declared = file.type.split(';', 1)[0].trim().toLowerCase()
  if (declared.startsWith('image/')) return declared

  const extension = file.name.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'avif':
      return 'image/avif'
    default:
      return declared || 'application/octet-stream'
  }
}

async function decodeWithImageElement(blob: Blob): Promise<DecodedImage> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('当前环境不支持图片解码')
  }

  const objectUrl = URL.createObjectURL(blob)
  const image = document.createElement('img')
  image.decoding = 'async'

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('图片无法解码'))
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('图片尺寸无效')
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => {
      image.src = ''
      URL.revokeObjectURL(objectUrl)
    },
  }
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      if (!bitmap.width || !bitmap.height) {
        bitmap.close()
        throw new Error('图片尺寸无效')
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Some Android WebViews expose createImageBitmap but cannot decode every
      // format. The image element fallback covers the formats WebView can show.
    }
  }

  return decodeWithImageElement(blob)
}

function chooseOutputMimeType(sourceMimeType: string): string {
  if (sourceMimeType === 'image/jpeg' || sourceMimeType === 'image/jpg') return 'image/jpeg'
  if (sourceMimeType === 'image/webp') return 'image/webp'

  // PNG and other potentially transparent inputs stay in a transparency-safe format.
  return 'image/png'
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片编码失败'))
      },
      mimeType,
      quality,
    )
  })
}

/** Decode and, only when oversized, resize an image for durable local storage. */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.toLowerCase().startsWith('image/') && !/\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('所选文件不是受支持的图片')
  }

  const mimeType = inferMimeType(file)
  const decoded = await decodeImage(file)

  try {
    const longestEdge = Math.max(decoded.width, decoded.height)
    if (longestEdge <= MAX_IMAGE_EDGE) {
      return {
        blob: file,
        mimeType,
        width: decoded.width,
        height: decoded.height,
        ...(file.name ? { fileName: file.name } : {}),
      }
    }

    if (typeof document === 'undefined') throw new Error('当前环境不支持图片缩放')

    const scale = MAX_IMAGE_EDGE / longestEdge
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    try {
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) throw new Error('无法创建图片处理画布')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(decoded.source, 0, 0, width, height)

      const outputMimeType = chooseOutputMimeType(mimeType)
      const quality = outputMimeType === 'image/png' ? undefined : LOSSY_IMAGE_QUALITY
      const blob = await canvasToBlob(canvas, outputMimeType, quality)

      return {
        blob,
        mimeType: blob.type || outputMimeType,
        width,
        height,
        ...(file.name ? { fileName: file.name } : {}),
      }
    } finally {
      // Releasing the backing store matters for a sequence of large phone photos.
      canvas.width = 1
      canvas.height = 1
    }
  } finally {
    decoded.dispose()
  }
}

/** Process multiple files with bounded concurrency while preserving input order. */
export function processImageFiles(
  files: File[],
  concurrency = DEFAULT_IMAGE_CONCURRENCY,
): Promise<Array<ProcessedImage | null>> {
  return mapWithConcurrency(files, concurrency, async (file) => {
    try {
      return await processImageFile(file)
    } catch {
      return null
    }
  })
}
