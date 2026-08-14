import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const EXPORT_DIRECTORY = 'echo-journal-exports'
const EXPORT_FILE_PREFIX = 'echo-journal-backup-'
const NATIVE_WRITE_CHUNK_BYTES = 1024 * 1024

async function blobChunkToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }

  return btoa(chunks.join(''))
}

/**
 * Capacitor's native Filesystem bridge accepts base64 strings. Writing the
 * whole archive at once would keep the ZIP ArrayBuffer, binary string and
 * base64 copy alive together, which is risky for photo-heavy backups in an
 * Android WebView. Encode and append bounded slices instead.
 */
async function writeBlobInChunks(blob: Blob, path: string) {
  if (blob.size === 0) {
    await Filesystem.writeFile({
      path,
      data: '',
      directory: Directory.Cache,
      recursive: true,
    })
    return
  }

  let firstChunk = true
  for (let offset = 0; offset < blob.size; offset += NATIVE_WRITE_CHUNK_BYTES) {
    const data = await blobChunkToBase64(
      blob.slice(offset, Math.min(offset + NATIVE_WRITE_CHUNK_BYTES, blob.size)),
    )

    if (firstChunk) {
      await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Cache,
        recursive: true,
      })
      firstChunk = false
    } else {
      await Filesystem.appendFile({
        path,
        data,
        directory: Directory.Cache,
      })
    }
  }
}

async function cleanupOldExports() {
  try {
    const { files } = await Filesystem.readdir({
      path: EXPORT_DIRECTORY,
      directory: Directory.Cache,
    })

    await Promise.all(files
      .filter((file) => file.type === 'file' && file.name.startsWith(EXPORT_FILE_PREFIX) && file.name.endsWith('.zip'))
      .map((file) => Filesystem.deleteFile({
        path: `${EXPORT_DIRECTORY}/${file.name}`,
        directory: Directory.Cache,
      })))
  } catch {
    // The directory normally does not exist before the first export.
  }
}

export async function shareNativeExport(blob: Blob, filename: string) {
  await cleanupOldExports()

  const path = `${EXPORT_DIRECTORY}/${filename}`
  await writeBlobInChunks(blob, path)

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  })

  await Share.share({
    title: '回声日记备份',
    text: '日记数据备份文件',
    files: [uri],
    dialogTitle: '保存或分享日记备份',
  })
}
