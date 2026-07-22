import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { entryRepo } from '../db/repository'
import { useUIStore } from '../store/uiStore'
import { ExportDialog } from '../components/ExportDialog'
import { ImportDialog } from '../components/ImportDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/ToastContext'
import { getSnapshots, createDailySnapshot, cleanupOldSnapshots, pinSnapshot, deleteSnapshot, restoreFromSnapshot } from '../services/snapshot'
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, DownloadIcon, PinIcon, ShieldIcon, TrashIcon, UploadIcon } from '../components/Icons'
import type { InternalSnapshot } from '../db/models'
import { db } from '../db/database'
import { getLocalDateString, toLocalDate } from '../utils/date'
import type { JournalFont } from '../store/uiStore'
import { loadJournalFontPreview } from '../utils/journalFonts'

const fontOptions: Array<{ value: JournalFont; label: string }> = [
  { value: 'modern', label: '现代' },
  { value: 'rounded', label: '圆体' },
  { value: 'fangsong', label: '书卷' },
  { value: 'display', label: '个性' },
  { value: 'handwriting', label: '手写' },
]

export function SettingsPage() {
  const { journalFont, loadingJournalFont, setJournalFont } = useUIStore()
  const [readyFontPreviews, setReadyFontPreviews] = useState<Set<JournalFont>>(() => new Set(['modern']))
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [restoreSnapshotId, setRestoreSnapshotId] = useState<string | null>(null)
  const [entryCount, setEntryCount] = useState(0)
  const [trashCount, setTrashCount] = useState(0)
  const [snapshots, setSnapshots] = useState<InternalSnapshot[]>([])
  const [showSnapshots, setShowSnapshots] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    for (const option of fontOptions) {
      if (option.value === 'modern') continue
      void loadJournalFontPreview(option.value).then((loaded) => {
        if (cancelled || !loaded) return
        setReadyFontPreviews((ready) => {
          if (ready.has(option.value)) return ready
          const next = new Set(ready)
          next.add(option.value)
          return next
        })
      })
    }
    return () => { cancelled = true }
  }, [])

  const loadStats = async () => {
    setEntryCount(await entryRepo.getEntryCount())
    setTrashCount(await entryRepo.getTrashCount())
  }
  const loadSnapshots = async () => setSnapshots(await getSnapshots())
  useEffect(() => { void Promise.all([loadStats(), loadSnapshots()]) }, [])

  const todaySnapshot = snapshots.some((snapshot) => toLocalDate(snapshot.createdAt) === getLocalDateString())

  const handleClearData = async () => {
    try {
      await db.entries.clear(); await db.drafts.clear(); await db.tags.clear(); await db.snapshots.clear()
      showToast('所有数据已清除', 'success')
      await Promise.all([loadStats(), loadSnapshots()])
    } catch { showToast('清除数据失败', 'error') }
  }

  const handleCreateSnapshot = async () => {
    try {
      const snapshot = await createDailySnapshot()
      showToast(snapshot ? '快照已创建' : '今天已有快照', snapshot ? 'success' : 'info')
      await loadSnapshots()
    } catch { showToast('创建快照失败', 'error') }
  }

  const handleRestoreSnapshot = async (id: string) => {
    try {
      await restoreFromSnapshot(id)
      showToast('已从快照恢复', 'success')
      await Promise.all([loadStats(), loadSnapshots()])
    } catch { showToast('恢复快照失败', 'error') }
  }

  return (
    <main className="page settings-page">
      <div className="page-heading"><h1>设置</h1><p>外观、回顾与本地数据</p></div>

      <section className="safety-overview" aria-labelledby="data-safety-title">
        <div className="safety-heading"><ShieldIcon /><div><h2 id="data-safety-title">数据安全</h2><p>数据只保存在当前设备</p></div></div>
        <div className="safety-stats">
          <div><strong>{entryCount}</strong><span>条日记</span></div>
          <div><strong>{todaySnapshot ? '已完成' : '待创建'}</strong><span>今日内部快照</span></div>
        </div>
      </section>

      <section className="settings-section backup-actions" aria-labelledby="backup-title">
        <div className="settings-section-title" id="backup-title">外部备份</div>
        <button type="button" className="backup-action" onClick={() => setShowExport(true)}><DownloadIcon /><span><strong>导出备份</strong><small>保存完整数据与可阅读 Markdown</small></span><ChevronRightIcon /></button>
        <button type="button" className="backup-action" onClick={() => setShowImport(true)}><UploadIcon /><span><strong>导入备份</strong><small>校验后合并或安全替换当前数据</small></span><ChevronRightIcon /></button>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">外观</div>
        <div className="appearance-settings">
          <div className="font-settings">
            <span className="font-settings-label">日记字体</span>
            <div className="font-choice-grid" role="radiogroup" aria-label="日记字体">
              {fontOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`font-choice ${journalFont === option.value ? 'active' : ''} ${readyFontPreviews.has(option.value) ? 'is-preview-ready' : ''}`}
                  data-font-preview={option.value}
                  role="radio"
                  aria-checked={journalFont === option.value}
                  aria-busy={loadingJournalFont === option.value}
                  disabled={loadingJournalFont === option.value}
                  onClick={() => void setJournalFont(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>风吹过旧书页，也吹乱了今天的心事。</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section snapshot-section">
        <button type="button" className="settings-disclosure" aria-expanded={showSnapshots} onClick={() => setShowSnapshots((value) => !value)}><span><strong>内部快照</strong><small>{snapshots.length} 份 · 自动保留最近 7 份</small></span>{showSnapshots ? <ChevronDownIcon /> : <ChevronRightIcon />}</button>
        {showSnapshots ? (
          <div className="snapshot-content">
            <div className="snapshot-toolbar"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleCreateSnapshot()}>创建今日快照</button><button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await cleanupOldSnapshots(); await loadSnapshots(); showToast('已清理过期快照', 'success') }}>清理过期快照</button></div>
            {snapshots.length === 0 ? <p className="timeline-empty">暂无内部快照。</p> : snapshots.map((snapshot) => (
              <div key={snapshot.id} className="snapshot-row">
                <div><strong>{new Date(snapshot.createdAt).toLocaleString('zh-CN')}</strong><small>{snapshot.entryCount} 条日记 · {(snapshot.size / 1024).toFixed(1)} KB{snapshot.isPinned ? ' · 已固定' : ''}</small></div>
                <div className="snapshot-actions"><button type="button" className="icon-button" aria-label={snapshot.isPinned ? '取消固定快照' : '固定快照'} onClick={async () => { await pinSnapshot(snapshot.id); await loadSnapshots() }}><PinIcon /></button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setRestoreSnapshotId(snapshot.id)}>恢复</button><button type="button" className="icon-button danger-action" aria-label="删除快照" onClick={async () => { await deleteSnapshot(snapshot.id); await loadSnapshots(); showToast('快照已删除', 'success') }}><TrashIcon /></button></div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">数据管理</div>
      </section>

      <section className="settings-section settings-links">
        <Link className="settings-disclosure" to="/trash"><span className="settings-row-label"><TrashIcon /><span><strong>回收站</strong><small>{trashCount > 0 ? `${trashCount} 条` : '回收站是空的'}</small></span></span><ChevronRightIcon /></Link>
        <Link className="settings-disclosure" to="/review"><span className="settings-row-label"><ClockIcon /><span><strong>过去的今天</strong><small>查看往年同一天的记录</small></span></span><ChevronRightIcon /></Link>
        <div className="settings-disclosure"><span><strong>关于回声日记</strong><small>本地优先的私人日记 · v1.0.2</small></span></div>
      </section>

      <section className="settings-section danger-zone">
        <div className="settings-section-title">危险操作</div>
        <button type="button" className="danger-row" onClick={() => setShowClearConfirm(true)}><TrashIcon /><span><strong>清除全部数据</strong><small>删除日记、草稿、标签与内部快照</small></span></button>
        <p>此操作不可撤销，请先导出备份。</p>
      </section>

      {showExport ? <ExportDialog onClose={() => setShowExport(false)} /> : null}
      {showImport ? <ImportDialog onClose={() => { setShowImport(false); void Promise.all([loadStats(), loadSnapshots()]) }} /> : null}
      {showClearConfirm ? <ConfirmDialog message="确定要清除全部数据吗？此操作不可撤销。建议先导出备份。" confirmLabel="清除全部数据" danger onConfirm={() => { void handleClearData(); setShowClearConfirm(false) }} onCancel={() => setShowClearConfirm(false)} /> : null}
      {restoreSnapshotId ? <ConfirmDialog message={`确定从这份快照恢复吗？恢复前会自动备份当前数据，失败时自动回滚。快照包含 ${snapshots.find((snapshot) => snapshot.id === restoreSnapshotId)?.entryCount ?? 0} 条日记。`} confirmLabel="确认恢复" danger onConfirm={() => { void handleRestoreSnapshot(restoreSnapshotId); setRestoreSnapshotId(null) }} onCancel={() => setRestoreSnapshotId(null)} /> : null}
    </main>
  )
}
