import { useEffect, useRef, useState } from 'react'
import type { Entry, CreateEntryInput } from '../db/models'
import { TagInput } from './TagInput'
import { XIcon } from './Icons'
import { ConfirmDialog } from './ConfirmDialog'

interface EntryEditorProps {
  entry?: Entry | null
  onSave: (input: CreateEntryInput) => Promise<void>
  onClose: () => void
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function EntryEditor({ entry, onSave, onClose }: EntryEditorProps) {
  const initialContent = entry?.content || ''
  const initialTitle = entry?.title || ''
  const initialTags = entry?.tags || []
  const initialCreatedAt = toDateTimeLocalValue(entry ? new Date(entry.createdAt) : new Date())

  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState(initialTitle)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [createdAt, setCreatedAt] = useState(initialCreatedAt)
  const [dateError, setDateError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const savedRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const hasChanges =
    content !== initialContent ||
    title !== initialTitle ||
    tags.join(',') !== initialTags.join(',') ||
    createdAt !== initialCreatedAt

  const handleSave = async () => {
    if (!content.trim()) return

    // Validate date
    if (!createdAt) {
      setDateError('请选择有效的时间')
      return
    }
    const parsedDate = new Date(createdAt)
    if (isNaN(parsedDate.getTime())) {
      setDateError('时间格式无效，请重新选择')
      return
    }

    setSaving(true)
    setDateError(null)
    try {
      await onSave({
        content: content.trim(),
        title: title.trim(),
        tags,
        createdAt: parsedDate.toISOString(),
      })
      savedRef.current = true
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (savedRef.current) return
    if (hasChanges && !saving) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="editor-title" className="modal-title">{entry ? '编辑日记' : '新建日记'}</h2>
          <button type="button" className="icon-button" aria-label="关闭编辑器" onClick={handleClose}><XIcon /></button>
        </header>

        <div className="editor-fields">
          <label className="field-label">
            <span>标题（可选）</span>
            <input className="journal-title-input" type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这一刻起个名字" />
          </label>
          <label className="field-label">
            <span>时间</span>
            <input
              type="datetime-local"
              value={createdAt}
              className={dateError ? 'input-error' : ''}
              onInput={(event) => {
                setCreatedAt(event.currentTarget.value)
                setDateError(null)
              }}
            />
            {dateError ? <span className="field-error">{dateError}</span> : null}
          </label>
          <label className="field-label editor-content-field">
            <span>正文</span>
            <textarea className="journal-content-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下此刻…" autoFocus />
          </label>
          <div className="field-label"><span>标签</span><TagInput tags={tags} onChange={setTags} /></div>
        </div>

        <div className="modal-actions editor-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || !content.trim()}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </section>

      {showCloseConfirm ? (
        <ConfirmDialog
          message="尚有未保存的修改，确定要放弃吗？"
          confirmLabel="放弃修改"
          cancelLabel="继续编辑"
          danger
          onConfirm={() => { setShowCloseConfirm(false); onClose() }}
          onCancel={() => setShowCloseConfirm(false)}
        />
      ) : null}
    </div>
  )
}