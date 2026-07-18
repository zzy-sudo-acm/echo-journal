import { useState, useEffect, useRef } from 'react'
import { useEntryStore } from '../store/entryStore'
import { TagInput } from './TagInput'
import { PlusIcon } from './Icons'
import { draftRepo } from '../db/repository'

export function QuickInput() {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const { createEntry, saveDraft, clearDraft } = useEntryStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftLoaded = useRef(false)

  // Load draft on mount (component remount = app reopened)
  useEffect(() => {
    let cancelled = false
    draftRepo.get().then((draft) => {
      if (cancelled) return
      if (draft && !draftLoaded.current) {
        draftLoaded.current = true
        setContent(draft.content)
        setTags(draft.tags)
        if (draft.content) setExpanded(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  // Auto-save draft on content/tag changes (debounced)
  useEffect(() => {
    if (!draftLoaded.current) return // Don't overwrite before initial load
    const timer = setTimeout(() => {
      if (content.trim()) {
        saveDraft({ content, title: '', tags })
      } else if (tags.length === 0) {
        // Content and tags both empty — no meaningful draft
        clearDraft()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [content, tags, saveDraft, clearDraft])

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await createEntry({ content: content.trim(), tags })
      setContent('')
      setTags([])
      setExpanded(false)
      draftLoaded.current = false // Allow new draft after save
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="quick-input">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          if (e.target.value) setExpanded(true)
        }}
        onFocus={() => setExpanded(true)}
        onKeyDown={handleKeyDown}
        placeholder="写点什么…"
        style={{ minHeight: expanded ? 100 : 48 }}
      />

      {expanded && (
        <>
          <div className="quick-input-tags">
            <TagInput tags={tags} onChange={setTags} placeholder="添加标签…" />
          </div>
          <div className="quick-input-footer">
            <span className="draft-indicator">
              {content.trim() ? '草稿已保存' : ''}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || !content.trim()}
            >
              <PlusIcon /> 记录
            </button>
          </div>
        </>
      )}
      {!expanded && content.trim() && (
        <div className="draft-indicator" style={{ marginTop: 8 }}>
          草稿已保存
        </div>
      )}
    </div>
  )
}
