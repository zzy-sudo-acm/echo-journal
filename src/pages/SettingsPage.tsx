import { useState, useEffect } from 'react'
import { entryRepo } from '../db/repository'
import { useUIStore } from '../store/uiStore'
import { ExportDialog } from '../components/ExportDialog'
import { ImportDialog } from '../components/ImportDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { getSnapshots, createDailySnapshot, cleanupOldSnapshots, pinSnapshot, deleteSnapshot, restoreFromSnapshot } from '../services/snapshot'
import { DownloadIcon, UploadIcon, SunIcon, MoonIcon, TrashIcon, PinIcon } from '../components/Icons'
import type { InternalSnapshot } from '../db/models'
import { db } from '../db/database'

export function SettingsPage() {
  const { theme, setTheme } = useUIStore()
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [entryCount, setEntryCount] = useState(0)
  const [tagCount, setTagCount] = useState(0)
  const [snapshots, setSnapshots] = useState<InternalSnapshot[]>([])
  const [showSnapshots, setShowSnapshots] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadStats()
    loadSnapshots()
  }, [])

  const loadStats = async () => {
    const count = await entryRepo.getEntryCount()
    const tags = await entryRepo.getAllTags()
    setEntryCount(count)
    setTagCount(tags.length)
  }

  const loadSnapshots = async () => {
    const snaps = await getSnapshots()
    setSnapshots(snaps)
  }

  const handleClearData = async () => {
    try {
      await db.entries.clear()
      await db.drafts.clear()
      await db.tags.clear()
      await db.snapshots.clear()
      showToast('所有数据已清除', 'success')
      loadStats()
      loadSnapshots()
    } catch {
      showToast('清除数据失败', 'error')
    }
  }

  const handleCreateSnapshot = async () => {
    try {
      const snap = await createDailySnapshot()
      if (snap) {
        showToast('快照已创建', 'success')
      } else {
        showToast('今天已有快照', 'info')
      }
      loadSnapshots()
    } catch (err) {
      showToast('创建快照失败', 'error')
    }
  }

  const handleCleanupSnapshots = async () => {
    await cleanupOldSnapshots()
    showToast('已清理过期快照', 'success')
    loadSnapshots()
  }

  const handlePinSnapshot = async (id: string) => {
    await pinSnapshot(id)
    loadSnapshots()
  }

  const handleDeleteSnapshot = async (id: string) => {
    await deleteSnapshot(id)
    showToast('快照已删除', 'success')
    loadSnapshots()
  }

  const handleRestoreSnapshot = async (id: string) => {
    try {
      await restoreFromSnapshot(id)
      showToast('已从快照恢复', 'success')
      loadStats()
      loadSnapshots()
    } catch {
      showToast('恢复快照失败', 'error')
    }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 24 }}>设置</h1>

      {/* Theme */}
      <div className="settings-section">
        <div className="settings-section-title">外观</div>
        <div className="settings-item">
          <span className="settings-item-label">
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            <span style={{ marginLeft: 8 }}>主题</span>
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '深色' : '浅色'}
          </button>
        </div>
      </div>

      {/* Data */}
      <div className="settings-section">
        <div className="settings-section-title">数据</div>
        <div className="settings-item">
          <span className="settings-item-label">日记数量</span>
          <span className="settings-item-value">{entryCount} 条</span>
        </div>
        <div className="settings-item">
          <span className="settings-item-label">标签数量</span>
          <span className="settings-item-value">{tagCount} 个</span>
        </div>
      </div>

      {/* Backup */}
      <div className="settings-section">
        <div className="settings-section-title">备份</div>
        <button className="btn btn-primary btn-block" onClick={() => setShowExport(true)} style={{ marginBottom: 8 }}>
          <DownloadIcon /> 导出备份
        </button>
        <button className="btn btn-secondary btn-block" onClick={() => setShowImport(true)} style={{ marginBottom: 8 }}>
          <UploadIcon /> 导入备份
        </button>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={handleCreateSnapshot}>
              创建快照
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleCleanupSnapshots}>
              清理过期快照
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setShowSnapshots(!showSnapshots)}
            >
              {showSnapshots ? '隐藏快照' : `查看快照 (${snapshots.length})`}
            </button>
          </div>
        </div>

        {showSnapshots && (
          <div style={{ marginTop: 16 }}>
            {snapshots.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>暂无内部快照</p>
            ) : (
              snapshots.map((snap) => (
                <div key={snap.id} className="backup-item">
                  <div className="backup-item-info">
                    <div className="backup-item-date">
                      {new Date(snap.createdAt).toLocaleString('zh-CN')}
                      {snap.isPinned && ' 📌'}
                    </div>
                    <div className="backup-item-meta">
                      {snap.entryCount} 条日记 · {(snap.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="backup-item-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => handlePinSnapshot(snap.id)}>
                      <PinIcon />
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleRestoreSnapshot(snap.id)}>
                      恢复
                    </button>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteSnapshot(snap.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="settings-section">
        <div className="settings-section-title">危险操作</div>
        <button
          className="btn btn-danger btn-block"
          onClick={() => setShowClearConfirm(true)}
        >
          清除全部数据
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
          此操作将删除所有日记、标签和内部备份。请先导出备份。
        </p>
      </div>

      {/* Info */}
      <div className="settings-section">
        <div className="settings-section-title">关于</div>
        <div className="settings-item">
          <span className="settings-item-label">回声日记</span>
          <span className="settings-item-value">v1.0.0</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>
          所有数据保存在当前设备中，不上传到任何服务器。
        </p>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showImport && <ImportDialog onClose={() => { setShowImport(false); loadStats(); loadSnapshots() }} />}
      {showClearConfirm && (
        <ConfirmDialog
          message="确定要清除全部数据吗？此操作不可撤销。建议先导出备份。"
          confirmLabel="清除全部数据"
          danger
          onConfirm={() => { handleClearData(); setShowClearConfirm(false) }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  )
}
