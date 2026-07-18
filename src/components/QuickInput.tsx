import { useState, useEffect, useRef, useCallback } from 'react'
import { useEntryStore } from '../store/entryStore'
import { TagInput } from './TagInput'
import { PlusIcon } from './Icons'

export function QuickInput() {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const { createEntry, saveDraft, draft, loadDraft } = useEntryStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      loadDraft()
    }
  }, [loadDraft])

  useEffect(() => {
    if (draft && !loadedRef.current) {
      setContent(draft.content)
      setTags(draft.tags)
    }
  }, [draft])

  const autoSave = useCallback(
    (text: string, currentTags: string[]) => {
      if (text.trim()) {
        saveDraft({ content: text, title: '', tags: currentTags })
      }
    },
    [saveDraft],
  )

  useEffect(() => {
    const timer = setTimeout(() => autoSave(content, tags), 500)
    return () => clearTimeout(timer)
  }, [content, tags, autoSave])

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await createEntry({ content: content.trim(), tags })
      setContent('')
      setTags([])
      setExpanded(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to save
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
