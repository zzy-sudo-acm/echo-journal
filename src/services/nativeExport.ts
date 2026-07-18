import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const EXPORT_DIRECTORY = 'echo-journal-exports'
const EXPORT_FILE_PREFIX = 'echo-journal-backup-'

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks: string[] = []
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }

  return btoa(chunks.join(''))
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
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  })

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
