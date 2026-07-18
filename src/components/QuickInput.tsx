import { useEffect, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { TagInput } from './TagInput'
import { TagIcon } from './Icons'
import { draftRepo } from '../db/repository'

interface QuickInputProps {
  onSaved?: () => void | Promise<void>
}

type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

export function QuickInput({ onSaved }: QuickInputProps) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const { createEntry, saveDraft, clearDraft } = useEntryStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editedSinceMount = useRef(false)

  useEffect(() => {
    let cancelled = false
    draftRepo.get().then((draft) => {
      if (cancelled) return
      if (draft && !editedSinceMount.current) {
        setContent(draft.content)
        setTags(draft.tags)
        if (draft.content || draft.tags.length > 0) {
          setExpanded(true)
          setDraftStatus('saved')
        }
      }
      setDraftLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!draftLoaded) return
    let verifyTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      if (!content.trim() && tags.length === 0) {
        await clearDraft()
        setDraftStatus('idle')
        return
      }

      setDraftStatus('saving')
      saveDraft({ content, title: '', tags })
      verifyTimer = setTimeout(async () => {
        try {
          const saved = await draftRepo.get()
          const matches = saved?.content === content && saved.tags.join('\u0000') === tags.join('\u0000')
          setDraftStatus(matches ? 'saved' : 'error')
        } catch {
          setDraftStatus('error')
        }
      }, 650)
    }, 350)

    return () => {
      clearTimeout(timer)
      if (verifyTimer) clearTimeout(verifyTimer)
    }
  }, [content, tags, draftLoaded, saveDraft, clearDraft])

  const handleSave = async () => {
    if (saving || !content.trim()) return
    setSaving(true)
    try {
      await createEntry({
        content: content.trim(),
        tags,
      })
      setContent('')
      setTags([])
      setTagEditorOpen(false)
      setExpanded(false)
      setDraftStatus('idle')
      await onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className={`quick-input ${expanded ? 'is-expanded' : ''}`} aria-label="快速记录">
      <div className="quick-input-topline">
        <textarea
          ref={textareaRef}
          value={content}
          rows={expanded ? 4 : 1}
          onChange={(event) => {
            editedSinceMount.current = true
            setContent(event.target.value)
            setDraftStatus(event.target.value ? 'saving' : 'idle')
          }}
          onFocus={() => {
            setFocused(true)
            setExpanded(true)
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              void handleSave()
            }
          }}
          placeholder={focused ? '写下此刻…' : '这里还很安静'}
        />
      </div>

      {expanded ? (
        <div className="quick-input-details">
          {tagEditorOpen ? (
            <div className="composer-tag-editor">
              <TagInput
                tags={tags}
                onChange={(nextTags) => {
                  editedSinceMount.current = true
                  setTags(nextTags)
                }}
                placeholder="输入标签，按回车添加"
                autoFocus
              />
            </div>
          ) : null}
          <div className="quick-input-footer">
            <div className="composer-tags">
              <button
                type="button"
                className={`composer-tag-trigger ${tagEditorOpen ? 'active' : ''}`}
                aria-label={tags.length ? '编辑标签' : '添加标签'}
                aria-expanded={tagEditorOpen}
                onClick={() => setTagEditorOpen((open) => !open)}
              >
                <TagIcon />
              </button>
              {!tagEditorOpen ? tags.map((tag) => <span key={tag}>#{tag}</span>) : null}
            </div>
            <span className={`sr-only status-${draftStatus}`} aria-live="polite">
              {draftStatus === 'saving' ? '正在保存草稿' : null}
              {draftStatus === 'saved' ? '草稿已保存' : null}
              {draftStatus === 'error' ? '草稿保存失败' : null}
            </span>
            {content.trim() ? (
              <button type="button" className="composer-save" onClick={() => void handleSave()} disabled={saving} aria-busy={saving}>
                记下
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
