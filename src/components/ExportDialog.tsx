import { useState, useEffect, useRef } from 'react'
import { createExportZip, generateExportFilename, generateBackupData, previewBackup } from '../services/backup'
import type { ExportPreview } from '../db/models'
import { XIcon, DownloadIcon } from './Icons'
import { Capacitor } from '@capacitor/core'
import { shareNativeExport } from '../services/nativeExport'
import { Sheet } from './ui/Overlay'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Some browsers (notably Safari) can cancel a download if the object URL
  // is revoked in the same tick as the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportingRef = useRef(false)
  const mountedRef = useRef(false)

  // Init
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    document.body.style.overflow = 'hidden'

    void generateBackupData()
      .then((data) => {
        if (!cancelled) {
          setPreview(previewBackup(data))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('无法读取本地数据，请稍后重试。')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      mountedRef.current = false
      document.body.style.overflow = ''
    }
  }, [])

  const handleExport = async () => {
    // Sync ref guard — prevents rapid double-click before re-render
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    setExportError(null)

    let blob: Blob | null = null
    let filename = ''

    try {
      blob = await createExportZip()
      filename = generateExportFilename()

      if (Capacitor.isNativePlatform()) {
        await shareNativeExport(blob, filename)
        onClose()
        return
      }

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

      // Fallback to download — reuse same blob
      downloadBlob(blob, filename)
      onClose()
    } catch (err) {
      // User cancelled share — just close
      if (err instanceof DOMException && err.name === 'AbortError') {
        onClose()
        return
      }
      // A WebView download link is not a reliable fallback for a failed native
      // filesystem/share operation. Keep the dialog open and report the failure.
      if (Capacitor.isNativePlatform()) {
        if (mountedRef.current) {
          setExportError('导出失败，未生成可分享的备份文件，请稍后重试。')
        }
        return
      }
      // Share failed but blob exists — retry download with same blob
      if (blob) {
        try {
          downloadBlob(blob, filename)
          onClose()
        } catch {
          if (mountedRef.current) {
            setExportError('导出失败，请稍后重试。')
          }
        }
        return
      }
      // No blob at all — genuine failure
      if (mountedRef.current) {
        setExportError('导出失败，请稍后重试。')
      }
    } finally {
      exportingRef.current = false
      if (mountedRef.current) {
        setExporting(false)
      }
    }
  }

  // Sheet routes overlay taps, Escape and the Android back button through here;
  // keep the original guard so an in-flight export cannot be dismissed.
  const handleRequestClose = () => {
    if (!exportingRef.current) onClose()
  }

  return (
    <Sheet onClose={handleRequestClose} ariaLabel="导出备份">
      <div className="dialog-header">
        <h2 className="modal-title">导出备份</h2>
        <button type="button" className="btn btn-ghost dialog-close" onClick={onClose} aria-label="关闭" disabled={exporting}>
          <XIcon />
        </button>
      </div>

      {loading ? (
        <p className="dialog-text-muted">正在准备备份数据…</p>
      ) : error ? (
        <p className="dialog-text-danger">{error}</p>
      ) : preview ? (
        <>
          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-label">正常日记</span>
              <span>{preview.activeEntryCount} 条</span>
            </div>
            {preview.trashEntryCount > 0 ? (
              <div className="preview-row">
                <span className="preview-label">回收站</span>
                <span>{preview.trashEntryCount} 条</span>
              </div>
            ) : null}
            <div className="preview-row">
              <span className="preview-label">标签数量</span>
              <span>{preview.tagCount} 个</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">图片数量</span>
              <span>{preview.mediaCount} 张</span>
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

          <p className="export-hint">
            backup.json 包含完整恢复数据，包括回收站中的记录；
            media/ 目录保存全部引用图片的本地二进制文件并带 SHA-256 校验；
            journal.md 只包含当前正常日记的纯文字，方便长期阅读。
          </p>

          {exportError ? (
            <p className="export-error">{exportError}</p>
          ) : null}

          <button type="button" className="btn btn-primary btn-block" onClick={handleExport} disabled={exporting}>
            {exporting ? '正在导出…' : <><DownloadIcon /> 导出备份</>}
          </button>
        </>
      ) : (
        <p className="dialog-text-danger">无法生成备份数据</p>
      )}
    </Sheet>
  )
}
