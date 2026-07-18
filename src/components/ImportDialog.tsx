import { useState, useRef } from 'react'
import type { BackupData, ExportPreview, ImportResult } from '../db/models'
import { parseImportFile, previewBackup, mergeImportWithRollback, replaceImportWithRollback, createRollbackSnapshot } from '../services/backup'
import { XIcon, UploadIcon } from './Icons'
import { useToast } from './ToastContext'
import { ConfirmDialog } from './ConfirmDialog'

type Stage = 'select' | 'preview' | 'mode' | 'confirmReplace' | 'result'

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('select')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [backupData, setBackupData] = useState<BackupData | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const parseResult = await parseImportFile(file)
    if ('error' in parseResult) {
      setErrorMessage(parseResult.error)
      showToast(parseResult.error, 'error')
      return
    }

    const { data } = parseResult.result
    const p = previewBackup(data)
    setBackupData(data)
    setPreview(p)
    setErrorMessage(null)
    setStage('preview')
  }

  const handleMerge = async () => {
    if (!backupData) return
    setImporting(true)
    try {
      // Create rollback snapshot before merge
      const snapshotId = await createRollbackSnapshot()
      const r = await mergeImportWithRollback(backupData, snapshotId)
      setResult(r)
      setStage('result')
      if (r.conflicts > 0) {
        showToast(`合并完成：${r.added} 条新增，${r.conflicts} 条冲突已保留两份`, 'success')
      } else {
        showToast(`合并完成：${r.added} 条新增，${r.updated} 条更新`, 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败，数据已保留原状', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleReplaceConfirm = () => {
    setStage('confirmReplace')
  }

  const handleReplace = async () => {
    if (!backupData) return
    setImporting(true)
    try {
      const snapshotId = await createRollbackSnapshot()
      await replaceImportWithRollback(backupData, snapshotId)
      setResult({
        added: backupData.entries.length,
        skipped: 0,
        updated: 0,
        conflicts: 0,
        totalEntries: backupData.entries.length,
      })
      setStage('result')
      showToast('数据替换完成', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '替换失败，数据已自动回滚', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>导入备份</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <XIcon />
          </button>
        </div>

        {stage === 'select' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <UploadIcon />
            <p style={{ marginTop: 16, marginBottom: 8, color: 'var(--text-secondary)' }}>
              选择之前导出的备份文件
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: 20 }}>
              支持 .zip 和 .json 格式的备份文件
            </p>
            {errorMessage && (
              <div className="preview-warning" style={{ marginBottom: 16 }}>
                {errorMessage}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/json,application/zip"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              选择文件
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
                <span className="preview-label">时间范围</span>
                <span>
                  {preview.earliestEntry
                    ? `${new Date(preview.earliestEntry).toLocaleDateString('zh-CN')} ~ ${preview.latestEntry ? new Date(preview.latestEntry).toLocaleDateString('zh-CN') : '—'}`
                    : '—'}
                </span>
              </div>
              <div className="preview-row">
                <span className="preview-label">数据版本</span>
                <span>v{preview.schemaVersion}（当前 v1）</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">校验状态</span>
                <span style={{ color: 'var(--success)' }}>✓ 校验通过</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">兼容性</span>
                <span style={{ color: preview.compatible ? 'var(--success)' : 'var(--danger)' }}>
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
                <button className="btn btn-secondary" onClick={() => { setStage('select'); setBackupData(null); setPreview(null) }}>
                  重新选择
                </button>
                <button className="btn btn-primary" onClick={() => setStage('mode')}>
                  继续导入
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--danger)', marginTop: 16 }}>
                备份文件存在问题，无法导入
              </p>
            )}
          </>
        )}

        {stage === 'mode' && (
          <>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              选择导入方式。系统会在导入前自动创建安全快照，失败时自动回滚。
            </p>

            <div className="preview-card" style={{ cursor: 'pointer' }} onClick={handleMerge}>
              <h3>合并数据</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                将备份中的日记合并到当前数据。重复记录自动跳过，更新记录按时间保留最新版，
                时间相同内容不同的冲突会保留两份。
              </p>
            </div>

            <div className="preview-card" style={{ cursor: 'pointer', border: '1px solid var(--danger)' }} onClick={handleReplaceConfirm}>
              <h3 style={{ color: 'var(--danger)' }}>替换当前数据</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                清空当前所有日记并用备份数据替换。系统会自动备份当前内容，失败时自动回滚。
              </p>
            </div>

            {importing && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>处理中…</p>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setStage('preview')}>
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
                <span style={{ color: 'var(--success)' }}>{result.added} 条</span>
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
                <span className="preview-label">冲突（已保留两份）</span>
                <span style={{ color: result.conflicts > 0 ? 'var(--danger)' : undefined }}>
                  {result.conflicts} 条
                </span>
              </div>
              <div className="preview-row">
                <span className="preview-label">当前总计</span>
                <span>{result.totalEntries} 条</span>
              </div>
            </div>
            <button className="btn btn-primary btn-block" onClick={onClose}>
              完成
            </button>
          </>
        )}

        {stage === 'confirmReplace' && (
          <ConfirmDialog
            message={`确定要用备份数据（${preview?.entryCount ?? 0} 条日记）替换当前所有日记吗？当前数据将先被自动备份。替换失败时自动回滚。`}
            confirmLabel="确认替换"
            danger
            onConfirm={() => { handleReplace() }}
            onCancel={() => setStage('mode')}
          />
        )}
      </div>
    </div>
  )
}
