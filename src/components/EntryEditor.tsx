import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import FileHandler from '@tiptap/extension-file-handler'
import type { Entry, CreateEntryInput } from '../db/models'
import { cleanupOrphanMedia, mediaRepo } from '../db/repository'
import { collectMediaIds, extractPlainText, plainTextToRichContent } from '../services/richContent'
import { processImageFiles } from '../services/imageProcessing'
import { LOCAL_MEDIA_UPDATED_EVENT } from '../utils/events'
import { TagInput } from './TagInput'
import { XIcon } from './Icons'
import { ConfirmDialog } from './ConfirmDialog'
import { EditorToolbar } from './EditorToolbar'
import { localImageExtension } from './rich-text/LocalImage'
import { useToast } from './ToastContext'

export interface EntryEditorProps {
  entry?: Entry | null
  onSave: (input: CreateEntryInput) => Promise<void>
  onClose: () => void
}

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function removeLocalImageNode(editor: Editor, mediaId: string) {
  const positions: Array<{ from: number; to: number }> = []
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'localImage' && node.attrs.mediaId === mediaId) {
      positions.push({ from: position, to: position + node.nodeSize })
    }
  })

  if (positions.length === 0) return
  const transaction = editor.state.tr
  for (const position of positions.reverse()) {
    transaction.delete(position.from, position.to)
  }
  editor.view.dispatch(transaction)
}

export function EntryEditor({ entry, onSave, onClose }: EntryEditorProps) {
  const initialContent = entry?.content || ''
  const initialTitle = entry?.title || ''
  const initialTags = entry?.tags || []
  const initialCreatedAt = toDateTimeLocalValue(entry ? new Date(entry.createdAt) : new Date())
  const [initialRichContent] = useState(() => entry?.richContent ?? plainTextToRichContent(initialContent))

  const [title, setTitle] = useState(initialTitle)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [createdAt, setCreatedAt] = useState(initialCreatedAt)
  const [dateError, setDateError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [imageTaskCount, setImageTaskCount] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedSelectionRef = useRef<number | null>(null)
  const imageHandlerRef = useRef<((files: File[], position: number) => void) | null>(null)
  const sessionMediaRef = useRef({ ids: new Set<string>(), committed: false })
  const closingRef = useRef(false)
  const mountedRef = useRef(true)
  const { showToast } = useToast()

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
    }),
    localImageExtension,
    FileHandler.configure({
      consumePasteEvent: true,
      onPaste: (currentEditor, files) => {
        imageHandlerRef.current?.(files, currentEditor.state.selection.from)
      },
      onDrop: (_currentEditor, files, position) => {
        imageHandlerRef.current?.(files, position)
      },
    }),
  ], [])

  const editor = useEditor({
    extensions,
    content: initialRichContent,
    autofocus: 'end',
    injectCSS: false,
    editorProps: {
      attributes: {
        class: 'journal-prosemirror',
        'aria-label': '日记正文',
      },
    },
    onUpdate: () => setEditorDirty(true),
  }, [])

  const documentState = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      let imageCount = 0
      current.state.doc.descendants((node) => {
        if (node.type.name === 'localImage') imageCount += 1
      })
      return { isEmpty: current.isEmpty, imageCount }
    },
  })

  const insertImages = useCallback(async (files: File[], requestedPosition: number) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/') || /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name))
    if (imageFiles.length === 0) {
      showToast('没有可插入的图片', 'info')
      return
    }

    setImageTaskCount((count) => count + 1)
    let created: Array<{ file: File; media: Awaited<ReturnType<typeof mediaRepo.create>> }> = []

    try {
      const createResults = await Promise.allSettled(imageFiles.map(async (file) => ({
        file,
        media: await mediaRepo.create({
          blob: file,
          mimeType: file.type || 'application/octet-stream',
          width: 1,
          height: 1,
          ...(file.name ? { fileName: file.name } : {}),
        }),
      })))
      created = createResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      for (const item of created) sessionMediaRef.current.ids.add(item.media.id)

      if (created.length === 0) throw new Error('无法保存所选图片')
      if (created.length !== imageFiles.length && mountedRef.current) {
        showToast(`${imageFiles.length - created.length} 张图片无法读取，已跳过`, 'error')
      }
      if (!mountedRef.current || editor.isDestroyed) return

      const maxPosition = editor.state.doc.content.size
      const position = Math.max(0, Math.min(requestedPosition, maxPosition))
      const imageNodes = created.map(({ file, media }) => ({
        type: 'localImage',
        attrs: {
          mediaId: media.id,
          alt: file.name || null,
          caption: null,
        },
      }))
      // A trailing text block keeps the caret after the whole image group.
      // Without it, ProseMirror may leave a NodeSelection on the final image,
      // so the next typed character would replace that image.
      const nodes = [...imageNodes, { type: 'paragraph' }]

      const inserted = editor.chain().focus().insertContentAt(position, nodes).run()
      if (!inserted) throw new Error('图片插入失败')

      const processed = await processImageFiles(created.map((item) => item.file), 2)
      let failed = 0
      for (let index = 0; index < created.length; index += 1) {
        const result = processed[index]
        const mediaId = created[index].media.id
        if (result) {
          await mediaRepo.update(mediaId, result)
          window.dispatchEvent(new CustomEvent(LOCAL_MEDIA_UPDATED_EVENT, { detail: mediaId }))
          continue
        }

        failed += 1
        if (mountedRef.current && !editor.isDestroyed) removeLocalImageNode(editor, mediaId)
        await mediaRepo.delete(mediaId)
        sessionMediaRef.current.ids.delete(mediaId)
      }

      if (failed > 0 && mountedRef.current) {
        showToast(`${failed} 张图片无法读取，已跳过`, 'error')
      }
    } catch {
      for (const item of created) {
        if (mountedRef.current && !editor.isDestroyed) removeLocalImageNode(editor, item.media.id)
        await mediaRepo.delete(item.media.id)
        sessionMediaRef.current.ids.delete(item.media.id)
      }
      if (mountedRef.current) showToast('图片插入失败', 'error')
    } finally {
      if (mountedRef.current) setImageTaskCount((count) => Math.max(0, count - 1))
      if (!mountedRef.current) {
        await cleanupOrphanMedia(created.map((item) => item.media.id))
      }
    }
  }, [editor, showToast])

  imageHandlerRef.current = (files, position) => {
    void insertImages(files, position)
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const sessionMedia = sessionMediaRef.current
    document.body.style.overflow = 'hidden'
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      document.body.style.overflow = previousOverflow
      if (!sessionMedia.committed && sessionMedia.ids.size > 0) {
        void cleanupOrphanMedia(sessionMedia.ids)
      }
    }
  }, [])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const viewport = window.visualViewport

    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight
      const top = viewport?.offsetTop ?? 0
      overlay.style.setProperty('--editor-viewport-height', `${height}px`)
      overlay.style.setProperty('--editor-viewport-top', `${top}px`)
    }

    updateViewport()
    const resizeTarget: EventTarget = viewport ?? window
    resizeTarget.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    return () => {
      resizeTarget.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  const imageBusy = imageTaskCount > 0
  const hasChanges =
    editorDirty ||
    title !== initialTitle ||
    tags.join(',') !== initialTags.join(',') ||
    createdAt !== initialCreatedAt
  const canSave = !documentState.isEmpty || documentState.imageCount > 0

  const handleSave = async () => {
    if (saving || imageBusy || !canSave) return

    if (!createdAt) {
      setDateError('请选择有效的时间')
      return
    }
    const parsedDate = new Date(createdAt)
    if (isNaN(parsedDate.getTime())) {
      setDateError('时间格式无效，请重新选择')
      return
    }

    const richContent = editor.getJSON()
    const content = extractPlainText(richContent).trim()
    const cleanupCandidates = new Set([
      ...collectMediaIds(initialRichContent),
      ...sessionMediaRef.current.ids,
    ])

    setSaving(true)
    setDateError(null)
    try {
      await onSave({
        content,
        richContent,
        title: title.trim(),
        tags,
        createdAt: parsedDate.toISOString(),
      })
      sessionMediaRef.current.committed = true
      void cleanupOrphanMedia(cleanupCandidates).catch(() => {
        // The entry is already safe; failed GC only leaves harmless unused media.
      })
      onClose()
    } catch {
      showToast('保存失败，请稍后重试', 'error')
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  const discardAndClose = async () => {
    if (closingRef.current || saving) return
    closingRef.current = true
    setDiscarding(true)
    try {
      if (sessionMediaRef.current.ids.size > 0) {
        await cleanupOrphanMedia(sessionMediaRef.current.ids)
      }
    } finally {
      onClose()
    }
  }

  const handleClose = () => {
    if (saving || discarding) return
    if (hasChanges) {
      setShowCloseConfirm(true)
    } else {
      void discardAndClose()
    }
  }

  const chooseImages = () => {
    savedSelectionRef.current = editor.state.selection.from
    fileInputRef.current?.click()
  }

  return (
    <div ref={overlayRef} className="modal-overlay editor-overlay" onClick={handleClose}>
      <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header editor-header">
          <div>
            <h2 id="editor-title" className="modal-title">{entry ? '编辑日记' : '新建日记'}</h2>
            <span className="editor-save-state">{imageBusy ? '正在整理图片…' : '内容仅保存在本机'}</span>
          </div>
          <button type="button" className="icon-button" aria-label="关闭编辑器" onClick={handleClose}><XIcon /></button>
        </header>

        <div className="editor-fields editor-scroll-region">
          <label className="field-label">
            <span>标题（可选）</span>
            <input className="journal-title-input" type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给这一刻起个名字" />
          </label>
          <label className="field-label editor-date-field">
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
          <div className="field-label editor-content-field">
            <span>正文</span>
            <div className="rich-editor-shell">
              <EditorToolbar editor={editor} imageBusy={imageBusy} onChooseImages={chooseImages} />
              <EditorContent editor={editor} className="journal-editor-content" />
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
                if (files.length > 0) {
                  void insertImages(files, savedSelectionRef.current ?? editor.state.selection.from)
                }
              }}
            />
            {imageBusy ? <span className="editor-image-status" aria-live="polite">图片正在本机压缩并永久保存，请稍候…</span> : null}
          </div>
          <div className="field-label"><span>标签</span><TagInput tags={tags} onChange={setTags} /></div>
        </div>

        <div className="modal-actions editor-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={saving || discarding}>取消</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || imageBusy || !canSave}>
            {saving ? '保存中…' : imageBusy ? '处理图片中…' : '保存'}
          </button>
        </div>
      </section>

      {showCloseConfirm ? (
        <ConfirmDialog
          message={imageBusy ? '图片仍在处理中，确定要放弃这次编辑吗？' : '尚有未保存的修改，确定要放弃吗？'}
          confirmLabel="放弃修改"
          cancelLabel="继续编辑"
          danger
          confirming={discarding}
          onConfirm={() => { setShowCloseConfirm(false); void discardAndClose() }}
          onCancel={() => setShowCloseConfirm(false)}
        />
      ) : null}
    </div>
  )
}
