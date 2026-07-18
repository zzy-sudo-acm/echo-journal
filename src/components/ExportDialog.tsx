import { useState, useEffect } from 'react'
import { createExportZip, generateExportFilename, generateBackupData, previewBackup } from '../services/backup'
import type { ExportPreview } from '../db/models'
import { XIcon, DownloadIcon } from './Icons'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateBackupData().then((data) => {
      setPreview(previewBackup(data))
      setLoading(false)
    })
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleExport = async () => {
    try {
      const blob = await createExportZip()
      const filename = generateExportFilename()

      // Try Web Share API first
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: 'application/zip' })
        const shareData = {
          title: '回声日记备份',
          text: '日记数据备份文件',
          files: [file],
        }
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          onClose()
          return
        }
      }

      // Fallback to download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      // User cancelled share or download failed — try download fallback
      if (err instanceof DOMException && err.name === 'AbortError') {
        onClose()
        return
      }
      try {
        const blob = await createExportZip()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = generateExportFilename()
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        onClose()
      } catch {
        // Silent fail
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>导出备份</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <XIcon />
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>正在准备备份数据…</p>
        ) : preview ? (
          <>
            <div className="preview-card">
              <div className="preview-row">
                <span className="preview-label">日记数量</span>
                <span>{preview.entryCount} 条</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">标签数量</span>
                <span>{preview.tagCount} 个</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">最早记录</span>
                <span>{preview.earliestEntry ? new Date(preview.earliestEntry).toLocaleDateString('zh-CN') : '—'}</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">最晚记录</span>
                <span>{preview.latestEntry ? new Date(preview.latestEntry).toLocaleDateString('zh-CN') : '—'}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              备份文件包含完整恢复数据（backup.json）和可阅读的 Markdown 日记（journal.md）。
              即使未来项目停止维护，你仍然可以直接打开 journal.md 阅读所有日记。
            </p>

            <button className="btn btn-primary btn-block" onClick={handleExport}>
              <DownloadIcon /> 导出备份
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--danger)' }}>无法生成备份数据</p>
        )}
      </div>
    </div>
  )
}
