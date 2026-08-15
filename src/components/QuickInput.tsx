import { useCallback, useEffect, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { useVisualViewport } from '../hooks/useVisualViewport'
import { useToast } from './ToastContext'
import { TagInput } from './TagInput'
import { ImageIcon, TagIcon, XIcon } from './Icons'
import { cleanupOrphanMedia, draftRepo, mediaRepo } from '../db/repository'
import { acquireMediaUrl } from '../services/mediaCache'
import { processImageFiles } from '../services/imageProcessing'
import { buildComposerRichContent } from '../services/markdownLite'
import { FOCUS_COMPOSER_EVENT, consumeComposerFocusRequest } from '../utils/events'

interface QuickInputProps {
  onSaved?: () => void | Promise<void>
}

type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name)
}

function ComposerMediaThumb({ mediaId, onRemove }: { mediaId: string; onRemove: (id: string) => void | Promise<void> }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const { promise, release } = acquireMediaUrl(mediaId)
    void promise.then((media) => {
      if (!disposed) setUrl(media?.url ?? null)
    })
    return () => {
      disposed = true
      release()
    }
  }, [mediaId])

  return (
    <span className="composer-media-thumb">
      {url ? <img src={url} alt="" /> : null}
      <button type="button" aria-label="移除图片" onClick={() => onRemove(mediaId)}>
        <XIcon />
      </button>
    </span>
  )
}

export function QuickInput({ onSaved }: QuickInputProps) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tagEditorOpen, setTagEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const { createEntry, clearDraft } = useEntryStore()
  const { showToast } = useToast()
  const composerRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editedSinceMount = useRef(false)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftLoadedRef = useRef(false)
  const mountedRef = useRef(true)
  // Latest draft payload, read on unmount so a pending debounce is never lost.
  const draftPayloadRef = useRef({ content: '', tags: [] as string[], mediaIds: [] as string[] })
  draftPayloadRef.current = { content, tags, mediaIds }
  // Media attached in this composer session; reclaimed if never saved.
  const sessionMediaRef = useRef(new Set<string>())
  const committedRef = useRef(false)
  // An in-flight save must keep its media alive even if the composer unmounts
  // before entryRepo.create resolves, otherwise the new entry could reference
  // blobs that the unmount cleanup just deleted.
  const saveInFlightRef = useRef(false)

  // Flush pending draft + reclaim uncommitted media on unmount
  useEffect(() => {
    mountedRef.current = true
    const sessionMedia = sessionMediaRef.current
    return () => {
      mountedRef.current = false

      const pendingTimer = draftTimer.current
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        draftTimer.current = null
      }

      // Navigating away in the debounce window must not drop the last edits:
      // the debounce timer was cancelled, so persist the latest payload now.
      // The draft write finishes first, so the follow-up media cleanup sees
      // (and keeps) any media the just-saved draft still references.
      void (async () => {
        if (draftLoadedRef.current) {
          const latest = draftPayloadRef.current
          if (latest.content.trim() || latest.tags.length > 0 || latest.mediaIds.length > 0) {
            try {
              await draftRepo.save({ content: latest.content, title: '', tags: latest.tags, mediaIds: latest.mediaIds })
            } catch {
              // Keep the existing draft; a later session still has the previous copy.
            }
          } else if (pendingTimer) {
            try {
              await draftRepo.clear()
            } catch {
              // Best effort.
            }
          }
        }

        if (!committedRef.current && !saveInFlightRef.current && sessionMedia.size > 0) {
          try {
            await cleanupOrphanMedia(sessionMedia)
          } catch {
            // Media GC is best-effort; orphaned Blobs are harmless.
          }
        }
      })()
    }
  }, [])

  // Load draft on mount
  useEffect(() => {
    let cancelled = false
    draftRepo.get().then((draft) => {
      if (cancelled) return
      if (draft && !editedSinceMount.current) {
        setContent(draft.content)
        setTags(draft.tags)
        const restoredMediaIds = draft.mediaIds ?? []
        setMediaIds(restoredMediaIds)
        for (const mediaId of restoredMediaIds) sessionMediaRef.current.add(mediaId)
        if (draft.content || draft.tags.length > 0 || restoredMediaIds.length > 0) {
          setExpanded(true)
          setDraftStatus('saved')
        }
      }
      draftLoadedRef.current = true
      setDraftLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  // The header's 编写 button lands here (cross-page safe via pending intent).
  useEffect(() => {
    const focusComposer = () => {
      consumeComposerFocusRequest()
      setExpanded(true)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        composerRef.current?.scrollIntoView({ block: 'nearest' })
      })
    }
    window.addEventListener(FOCUS_COMPOSER_EVENT, focusComposer)
    if (consumeComposerFocusRequest()) focusComposer()
    return () => window.removeEventListener(FOCUS_COMPOSER_EVENT, focusComposer)
  }, [])

  const collapseComposer = useCallback(() => {
    setFocused(false)
    setExpanded(false)
    setTagEditorOpen(false)
  }, [])

  // Android keeps the textarea focused when the Back button only dismisses the
  // soft keyboard. Follow the visual viewport so the paper can fold back even
  // when the browser does not emit a blur event.
  const restingHeightRef = useRef(0)
  const keyboardVisibleRef = useRef(false)

  useVisualViewport(({ height }) => {
    const activeElement = document.activeElement
    const composerHasFocus = activeElement instanceof HTMLElement
      && Boolean(composerRef.current?.contains(activeElement))

    if (!composerHasFocus) {
      restingHeightRef.current = height
      keyboardVisibleRef.current = false
      return
    }

    if (restingHeightRef.current === 0) restingHeightRef.current = height
    const restingHeight = restingHeightRef.current
    const keyboardThreshold = Math.min(120, restingHeight * 0.22)
    if (height < restingHeight - keyboardThreshold) {
      keyboardVisibleRef.current = true
      return
    }

    if (keyboardVisibleRef.current && height >= restingHeight - 48) {
      keyboardVisibleRef.current = false
      activeElement.blur()
      collapseComposer()
    }
  })

  // Single debounce layer for draft saving
  useEffect(() => {
    if (!draftLoaded) return

    // Cancel any pending draft save
    if (draftTimer.current) {
      clearTimeout(draftTimer.current)
      draftTimer.current = null
    }

    if (!content.trim() && tags.length === 0 && mediaIds.length === 0) {
      clearDraft()
      setDraftStatus('idle')
      return
    }

    setDraftStatus('saving')
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null
      draftRepo.save({ content, title: '', tags, mediaIds }).then(() => {
        setDraftStatus('saved')
      }).catch(() => {
        setDraftStatus('error')
      })
    }, 600)

    return () => {
      // Don't clear timer on cleanup — we want it to fire
    }
  }, [content, tags, mediaIds, draftLoaded, clearDraft])

  const handlePickImages = async (files: File[]) => {
    const imageFiles = files.filter(isImageFile)
    if (imageFiles.length === 0) {
      showToast('没有可插入的图片', 'info')
      return
    }

    setImageBusy(true)
    const createdMediaIds: string[] = []
    try {
      const processed = await processImageFiles(imageFiles)
      let failed = 0
      for (const result of processed) {
        if (!result) {
          failed += 1
          continue
        }
        const media = await mediaRepo.create({
          blob: result.blob,
          mimeType: result.mimeType,
          width: result.width,
          height: result.height,
          ...(result.fileName ? { fileName: result.fileName } : {}),
        })
        createdMediaIds.push(media.id)
        // Component gone while the image was being written? Don't attach it;
        // the finally block reclaims everything created in this batch.
        if (!mountedRef.current) break
        committedRef.current = false
        sessionMediaRef.current.add(media.id)
        setMediaIds((current) => [...current, media.id])
      }
      if (mountedRef.current && failed > 0) {
        showToast(`${failed} 张图片无法读取，已跳过`, 'error')
      }
    } catch {
      if (mountedRef.current) showToast('图片处理失败，请稍后重试', 'error')
    } finally {
      if (mountedRef.current) {
        setImageBusy(false)
      } else if (createdMediaIds.length > 0) {
        // The unmount cleanup ran before these writes finished.
        void cleanupOrphanMedia(createdMediaIds)
      }
    }
  }

  const handleRemoveImage = async (mediaId: string) => {
    committedRef.current = false
    setMediaIds((current) => current.filter((id) => id !== mediaId))
    sessionMediaRef.current.delete(mediaId)
    try {
      // Attached-but-unsaved media is referenced nowhere else yet.
      await mediaRepo.delete(mediaId)
    } catch {
      if (!mountedRef.current) {
        // The unmount cleanup already ran without this id — don't leak it.
        void cleanupOrphanMedia([mediaId])
        return
      }
      // Keep it tracked for the unmount cleanup instead of leaking an orphan.
      sessionMediaRef.current.add(mediaId)
      showToast('图片移除失败，请稍后重试', 'error')
    }
  }

  const canSave = Boolean(content.trim()) || mediaIds.length > 0

  const handleSave = async () => {
    if (saving || imageBusy || !canSave) return

    // Cancel any pending draft save before creating entry
    if (draftTimer.current) {
      clearTimeout(draftTimer.current)
      draftTimer.current = null
    }

    const richContent = buildComposerRichContent(content.trim(), mediaIds)

    setSaving(true)
    saveInFlightRef.current = true
    let saved = false
    try {
      await createEntry({
        content: content.trim(),
        ...(richContent ? { richContent } : {}),
        tags,
      })
      saved = true
    } catch {
      if (!mountedRef.current) {
        // The unmount cleanup skipped these ids because the save was still
        // in flight; reclaim them now that it failed.
        void cleanupOrphanMedia(mediaIds)
      } else {
        showToast('保存失败，请稍后重试', 'error')
      }
    } finally {
      saveInFlightRef.current = false
      if (mountedRef.current) setSaving(false)
    }
    if (!saved) return

    committedRef.current = true
    sessionMediaRef.current.clear()
    setContent('')
    setTags([])
    setMediaIds([])
    setTagEditorOpen(false)
    setExpanded(false)
    setDraftStatus('idle')
    try {
      await onSaved?.()
    } catch {
      // The entry is already saved; a post-save callback failure is non-fatal.
    }
  }

  return (
    <aside
      ref={composerRef}
      className={`quick-input ${expanded ? 'is-expanded' : ''}`}
      aria-label="快速记录"
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          if (!composerRef.current?.contains(document.activeElement)) {
            collapseComposer()
          }
        })
      }}
    >
      <div className="quick-input-topline">
        <textarea
          ref={textareaRef}
          value={content}
          rows={expanded ? 4 : 1}
          onChange={(event) => {
            editedSinceMount.current = true
            committedRef.current = false
            setContent(event.target.value)
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
                  committedRef.current = false
                  setTags(nextTags)
                }}
                placeholder="输入标签，按回车添加"
                autoFocus
              />
            </div>
          ) : null}
          {mediaIds.length > 0 ? (
            <div className="composer-media">
              {mediaIds.map((mediaId) => (
                <ComposerMediaThumb key={mediaId} mediaId={mediaId} onRemove={handleRemoveImage} />
              ))}
            </div>
          ) : null}
          <div className="quick-input-footer">
            <div className="composer-tags">
              <button
                type="button"
                className="composer-tag-trigger"
                aria-label="添加图片"
                disabled={imageBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon />
              </button>
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
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ''
                if (files.length > 0) void handlePickImages(files)
              }}
            />
            <span className={`sr-only status-${draftStatus}`} aria-live="polite">
              {draftStatus === 'saving' ? '正在保存草稿' : null}
              {draftStatus === 'saved' ? '草稿已保存' : null}
              {draftStatus === 'error' ? '草稿保存失败' : null}
            </span>
            <span className="composer-draft-state" aria-hidden="true">
              {imageBusy ? '整理图片中…' : null}
              {!imageBusy && draftStatus === 'saving' ? '存草稿中…' : null}
              {!imageBusy && draftStatus === 'saved' ? '草稿已存' : null}
              {!imageBusy && draftStatus === 'error' ? '草稿保存失败' : null}
            </span>
            {canSave ? (
              <button type="button" className="composer-save" onClick={() => void handleSave()} disabled={saving || imageBusy} aria-busy={saving}>
                记下
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
