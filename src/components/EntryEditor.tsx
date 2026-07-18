import { useState, useEffect } from 'react'
import type { Entry, CreateEntryInput } from '../db/models'
import { TagInput } from './TagInput'
import { XIcon } from './Icons'

interface EntryEditorProps {
  entry?: Entry | null
  onSave: (input: CreateEntryInput) => Promise<void>
  onClose: () => void
}

export function EntryEditor({ entry, onSave, onClose }: EntryEditorProps) {
  const [content, setContent] = useState(entry?.content || '')
  const [title, setTitle] = useState(entry?.title || '')
  const [tags, setTags] = useState<string[]>(entry?.tags || [])
  const [saving, setSaving] = useState(false)
  const [createdAt, setCreatedAt] = useState(
    entry?.createdAt
      ? new Date(entry.createdAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )

  useEffect(() => {
    // Lock body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
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
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>
            {entry ? '编辑日记' : '新建日记'}
          </h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <XIcon />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这一天起个名字…"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              时间
            </label>
            <input
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9375rem',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                width: '100%',
              }}
            />
          </div>

          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写点什么…"
              autoFocus
              style={{ minHeight: 160 }}
            />
          </div>

          <div>
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !content.trim()}
            style={{ opacity: saving || !content.trim() ? 0.5 : 1 }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
