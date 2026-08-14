import { useState, useRef } from 'react'
import type { ExportPreview, ImportResult, ParsedBackup } from '../db/models'
import { SCHEMA_VERSION } from '../db/models'
import { parseImportFile, previewBackup, mergeImportWithRollback, replaceImportWithRollback, createRollbackSnapshot } from '../services/backup'
import { XIcon, UploadIcon } from './Icons'
import { useToast } from './ToastContext'
import { ConfirmDialog } from './ConfirmDialog'
import { Sheet } from './ui/Overlay'

type Stage = 'select' | 'preview' | 'mode' | 'confirmReplace' | 'result'

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('select')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [parsedBackup, setParsedBackup] = useState<ParsedBackup | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const importingRef = useRef(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    try {
      const parseResult = await parseImportFile(file)
      if ('error' in parseResult) {
        setParsedBackup(null)
        setPreview(null)
        setErrorMessage(parseResult.error)
        showToast(parseResult.error, 'error')
        return
      }

      setParsedBackup(parseResult.result)
      setPreview(previewBackup(parseResult.result.data))
      setErrorMessage(null)
      setStage('preview')
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  const handleMerge = async () => {
    if (!parsedBackup || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    try {
      // Create rollback snapshot before merge
      const snapshotId = await createRollbackSnapshot()
      const r = await mergeImportWithRollback(parsedBackup, snapshotId)
      setResult(r)
      setStage('result')
      if (r.conflicts > 0) {
        showToast(`合并完成：${r.added} 条新增，${r.conflicts} 条冲突已安全处理`, 'success')
      } else {
        showToast(`合并完成：${r.added} 条新增，${r.updated} 条更新`, 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败，数据已保留原状', 'error')
    } finally {
      importingRef.current = false
      setImporting(false)
    }
  }

  const handleReplaceConfirm = () => {
    if (importing) return
    setStage('confirmReplace')
  }

  const handleReplace = async () => {
    if (!parsedBackup || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    try {
      const snapshotId = await createRollbackSnapshot()
      await replaceImportWithRollback(parsedBackup, snapshotId)
      setResult({
        added: parsedBackup.data.entries.length,
        skipped: 0,
        updated: 0,
        conflicts: 0,
        totalEntries: parsedBackup.data.entries.length,
      })
      setStage('result')
      showToast('数据替换完成', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '替换失败，数据已自动回滚', 'error')
    } finally {
      importingRef.current = false
      setImporting(false)
    }
  }

  // Sheet routes overlay taps, Escape and the Android back button through here;
  // keep the original guard so the dialog stays open while parsing/importing.
  const handleRequestClose = () => {
    if (!importing && !parsing) onClose()
  }

  return (
    <Sheet onClose={handleRequestClose} ariaLabel="导入备份">
      <div className="dialog-header">
        <h2 className="modal-title">导入备份</h2>
        <button type="button" className="btn btn-ghost dialog-close" onClick={onClose} aria-label="关闭" disabled={importing || parsing}>
          <XIcon />
        </button>
      </div>

      {stage === 'select' && (
        <div className="import-select">
          <UploadIcon />
          <p className="import-select-text">
            选择之前导出的备份文件
          </p>
          <p className="import-select-hint">
            支持 .zip 和 .json 格式的备份文件
          </p>
          {errorMessage && (
            <div className="preview-warning import-file-error">
              {errorMessage}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,application/json,application/zip"
            onChange={handleFileSelect}
            className="import-file-input"
          />
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? '正在校验备份…' : '选择文件'}
          </button>
        </div>
      )}

      {stage === 'preview' && preview && (
        <>
          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-label">备份时间</span>
              <span>{preview.exportedAt ? new Date(preview.exportedAt).toLocaleString('zh-CN') : '未知'}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">日记数量</span>
              <span>{preview.entryCount} 条</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">标签数量</span>
              <span>{preview.tagCount} 个</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">图片数量</span>
              <span>{preview.mediaCount} 张</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">时间范围</span>
              <span>
                {preview.earliestEntry
                  ? `${new Date(preview.earliestEntry).toLocaleDateString('zh-CN')} ~ ${preview.latestEntry ? new Date(preview.latestEntry).toLocaleDateString('zh-CN') : '—'}`
                  : '—'}
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-label">数据版本</span>
              <span>v{preview.schemaVersion}（当前 v{SCHEMA_VERSION}）</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">校验状态</span>
              <span className="dialog-text-success">✓ 校验通过</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">兼容性</span>
              <span className={preview.compatible ? 'dialog-text-success' : 'dialog-text-danger'}>
                {preview.compatible ? '兼容' : '可能不兼容'}
              </span>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="preview-warning">
              {preview.errors.map((e, i) => (
                <div key={i}>⚠ {e}</div>
              ))}
            </div>
          )}

          {preview.isValid ? (
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setStage('select'); setParsedBackup(null); setPreview(null) }}>
                重新选择
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStage('mode')}>
                继续导入
              </button>
            </div>
          ) : (
            <p className="import-invalid">
              备份文件存在问题，无法导入
            </p>
          )}
        </>
      )}

      {stage === 'mode' && (
        <>
          <p className="import-mode-intro">
            选择导入方式。系统会在导入前自动创建安全快照，失败时自动回滚。
          </p>

          <button
            type="button"
            className="preview-card import-mode-card"
            onClick={handleMerge}
            disabled={importing}
            aria-pressed={importing}
          >
            <h3>合并数据</h3>
            <p className="import-mode-desc">
              将备份中的日记合并到当前数据。重复记录自动跳过，更新记录按时间保留最新版，
              时间相同内容不同的冲突会保留两份。
            </p>
          </button>

          <button
            type="button"
            className="preview-card import-mode-card import-mode-card--danger"
            onClick={handleReplaceConfirm}
            disabled={importing}
            aria-pressed={false}
          >
            <h3>替换当前数据</h3>
            <p className="import-mode-desc">
              清空当前所有日记并用备份数据替换。系统会自动备份当前内容，失败时自动回滚。
            </p>
          </button>

          {importing && <p className="import-progress">处理中…</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStage('preview')} disabled={importing}>
              返回
            </button>
          </div>
        </>
      )}

      {stage === 'result' && result && (
        <>
          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-label">新增日记</span>
              <span className="dialog-text-success">{result.added} 条</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">已存在（跳过）</span>
              <span>{result.skipped} 条</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">更新</span>
              <span>{result.updated} 条</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">冲突（已安全处理）</span>
              <span className={result.conflicts > 0 ? 'dialog-text-danger' : undefined}>
                {result.conflicts} 条
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-label">当前总计</span>
              <span>{result.totalEntries} 条</span>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            完成
          </button>
        </>
      )}

      {stage === 'confirmReplace' && (
        <ConfirmDialog
          message={`确定要用备份数据（${preview?.entryCount ?? 0} 条日记、${preview?.mediaCount ?? 0} 张图片）替换当前所有日记吗？当前数据将先被自动备份。替换失败时自动回滚。`}
          confirmLabel="确认替换"
          danger
          onConfirm={() => { handleReplace() }}
          onCancel={() => { if (!importing) setStage('mode') }}
        />
      )}
    </Sheet>
  )
}
