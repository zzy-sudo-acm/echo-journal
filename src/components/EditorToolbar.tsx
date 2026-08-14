import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  BoldIcon,
  BulletListIcon,
  HorizontalRuleIcon,
  ImageIcon,
  ItalicIcon,
  OrderedListIcon,
  ParagraphIcon,
  QuoteIcon,
  RedoIcon,
  UndoIcon,
} from './Icons'

interface ToolbarButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  children: ReactNode
  onActivate: () => void
}

function ToolbarButton({ label, active = false, disabled = false, children, onActivate }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`editor-tool ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onActivate}
    >
      {children}
    </button>
  )
}

interface EditorToolbarProps {
  editor: Editor
  imageBusy: boolean
  onChooseImages: () => void
}

export function EditorToolbar({ editor, imageBusy, onChooseImages }: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current.isActive('paragraph'),
      heading2: current.isActive('heading', { level: 2 }),
      heading3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      blockquote: current.isActive('blockquote'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
    }),
  })

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="正文格式">
      <div className="editor-toolbar-track">
        <ToolbarButton label="普通正文" active={state.paragraph} onActivate={() => editor.chain().focus().setParagraph().run()}>
          <ParagraphIcon />
        </ToolbarButton>
        <ToolbarButton label="二级标题" active={state.heading2} onActivate={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="editor-tool-text">H2</span>
        </ToolbarButton>
        <ToolbarButton label="三级标题" active={state.heading3} onActivate={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <span className="editor-tool-text">H3</span>
        </ToolbarButton>
        <span className="editor-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="粗体" active={state.bold} onActivate={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton label="斜体" active={state.italic} onActivate={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton label={imageBusy ? '正在处理图片' : '插入图片'} disabled={imageBusy} onActivate={onChooseImages}>
          <ImageIcon />
        </ToolbarButton>
        <span className="editor-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="引用" active={state.blockquote} onActivate={() => editor.chain().focus().toggleBlockquote().run()}>
          <QuoteIcon />
        </ToolbarButton>
        <ToolbarButton label="无序列表" active={state.bulletList} onActivate={() => editor.chain().focus().toggleBulletList().run()}>
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton label="有序列表" active={state.orderedList} onActivate={() => editor.chain().focus().toggleOrderedList().run()}>
          <OrderedListIcon />
        </ToolbarButton>
        <ToolbarButton label="插入分隔线" onActivate={() => editor.chain().focus().setHorizontalRule().run()}>
          <HorizontalRuleIcon />
        </ToolbarButton>
        <span className="editor-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="撤销" onActivate={() => editor.chain().focus().undo().run()}>
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton label="重做" onActivate={() => editor.chain().focus().redo().run()}>
          <RedoIcon />
        </ToolbarButton>
      </div>
    </div>
  )
}
