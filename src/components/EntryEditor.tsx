import { useEffect, useState } from 'react'
import type { Entry, CreateEntryInput } from '../db/models'
import { TagInput } from './TagInput'
import { XIcon } from './Icons'

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
  const [content, setContent] = useState(entry?.content || '')
  const [title, setTitle] = useState(entry?.title || '')
  const [tags, setTags] = useState<string[]>(entry?.tags || [])
  const [saving, setSaving] = useState(false)
  const [createdAt, setCreatedAt] = useState(() => toDateTimeLocalValue(entry ? new Date(entry.createdAt) : new Date()))

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await onSave({
        content: content.trim(),
        title: title.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        createdAt: new Date(createdAt).toISOString(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="editor-title" className="modal-title">{entry ? '编辑日记' : '新建日记'}</h2>
          <button type="button" className="icon-button" aria-label="关闭编辑器" onClick={onClose}><XIcon /></button>
        </header>

        <div className="editor-fields">
          <label className="field-label">
            <span>标题（可选）</span>
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这一刻起个名字" />
          </label>
          <label className="field-label">
            <span>时间</span>
            <input type="datetime-local" value={createdAt} onInput={(event) => setCreatedAt(event.currentTarget.value)} />
          </label>
          <label className="field-label editor-content-field">
            <span>正文</span>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下此刻…" autoFocus />
          </label>
          <div className="field-label"><span>标签</span><TagInput tags={tags} onChange={setTags} /></div>
        </div>

        <div className="modal-actions editor-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || !content.trim()}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </section>
    </div>
  )
}
