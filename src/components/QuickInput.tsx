import { useEffect, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { TagInput } from './TagInput'
import { CheckIcon, ClockIcon, PlusIcon, XIcon } from './Icons'
import { draftRepo } from '../db/repository'

interface QuickInputProps {
  onSaved?: () => void | Promise<void>
}

type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function QuickInput({ onSaved }: QuickInputProps) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [createdAt, setCreatedAt] = useState(() => toDateTimeLocalValue(new Date()))
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const { createEntry, saveDraft, clearDraft } = useEntryStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftLoaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    draftRepo.get().then((draft) => {
      if (cancelled) return
      draftLoaded.current = true
      if (draft) {
        setContent(draft.content)
        setTags(draft.tags)
        if (draft.content || draft.tags.length > 0) {
          setExpanded(true)
          setDraftStatus('saved')
        }
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
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
  }, [content, tags, saveDraft, clearDraft])

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await createEntry({
        content: content.trim(),
        tags,
        createdAt: new Date(createdAt).toISOString(),
      })
      setContent('')
      setTags([])
      setCreatedAt(toDateTimeLocalValue(new Date()))
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
            setContent(event.target.value)
            setDraftStatus(event.target.value ? 'saving' : 'idle')
          }}
          onFocus={() => setExpanded(true)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              void handleSave()
            }
          }}
          placeholder="写下此刻…"
        />
        {expanded ? <button type="button" className="icon-button composer-close" aria-label="收起记录区" onClick={() => setExpanded(false)}><XIcon /></button> : null}
      </div>

      {expanded ? (
        <div className="quick-input-details">
          <TagInput tags={tags} onChange={setTags} placeholder="添加标签" />
          <div className="quick-input-footer">
            <label className="composer-time">
              <ClockIcon />
              <span className="sr-only">记录时间</span>
              <input type="datetime-local" value={createdAt} onInput={(event) => setCreatedAt(event.currentTarget.value)} />
            </label>
            <span className={`draft-indicator status-${draftStatus}`} aria-live="polite">
              {draftStatus === 'saving' ? '正在保存草稿…' : null}
              {draftStatus === 'saved' ? <><CheckIcon />草稿已保存</> : null}
              {draftStatus === 'error' ? '草稿保存失败' : null}
            </span>
            <button type="button" className="btn btn-primary composer-save" onClick={() => void handleSave()} disabled={saving || !content.trim()}>
              <PlusIcon />{saving ? '保存中…' : '记下'}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
