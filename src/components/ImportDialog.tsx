import { useState, useRef } from 'react'
import type { BackupData, ExportPreview, ImportResult } from '../db/models'
import { parseImportFile, previewBackup, mergeImport, replaceImport, createRollbackSnapshot } from '../services/backup'
import { XIcon, UploadIcon } from './Icons'
import { useToast } from './Toast'

type Stage = 'select' | 'preview' | 'mode' | 'result'

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('select')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [backupData, setBackupData] = useState<BackupData | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const data = await parseImportFile(file)
    if (!data) {
      showToast('无法解析备份文件，请检查文件格式', 'error')
      return
    }

    const p = previewBackup(data)
    setBackupData(data)
    setPreview(p)
    setStage('preview')
  }

  const handleMerge = async () => {
    if (!backupData) return
    setImporting(true)
    try {
      // Create rollback snapshot before merge
      await createRollbackSnapshot()
      const r = await mergeImport(backupData)
      setResult(r)
      setStage('result')
      showToast('数据合并完成', 'success')
    } catch (err) {
      showToast('导入失败，数据已保留原状', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleReplace = async () => {
    if (!backupData) return
    setImporting(true)
    try {
      // Create safety snapshot before replacing
      await createRollbackSnapshot()
      await replaceImport(backupData)
      // Success — we can keep or clean up the rollback snapshot
      showToast('数据替换完成', 'success')
      setResult({ added: backupData.entries.length, skipped: 0, updated: 0, conflicts: 0, totalEntries: backupData.entries.length })
      setStage('result')
    } catch (err) {
      showToast('替换失败，数据已自动回滚', 'error')
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
              支持 .json 格式的备份文件
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
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
                <span className="preview-label">数据版本</span>
                <span>v{preview.schemaVersion}（当前 v1）</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">应用版本</span>
                <span>{preview.appVersion}</span>
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
            <p style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
              选择导入方式：
            </p>

            <div className="preview-card" style={{ cursor: 'pointer' }} onClick={handleMerge}>
              <h3>合并数据</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                将备份中的日记合并到当前数据。重复的记录自动跳过，更新的记录按时间保留最新版。
              </p>
            </div>

            <div className="preview-card" style={{ cursor: 'pointer', border: '1px solid var(--danger)' }} onClick={handleReplace}>
              <h3 style={{ color: 'var(--danger)' }}>替换当前数据</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                清空当前所有日记并用备份数据替换。替换前会自动备份当前内容，失败时自动回滚。
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
                <span>{result.added} 条</span>
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
                <span className="preview-label">冲突</span>
                <span>{result.conflicts} 条</span>
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
      </div>
    </div>
  )
}
