import type { RichContent } from '../db/models'
import { plainTextToRichContent } from './richContent'

/**
 * Lightweight composer markup → Tiptap-compatible document.
 *
 * The quick composer stays a plain textarea (极简); structure is recognized
 * only at save time. Node names match StarterKit/JournalRenderer exactly, so
 * entries written here open fine in the full editor afterwards.
 *
 * Supported:
 *   ## / ### 标题        → heading level 2 / 3
 *   > 引用（连续行）      → blockquote with hardBreaks
 *   - / * 连续行         → bulletList
 *   1. 2. 连续行         → orderedList
 *   --- / *** / ___     → horizontalRule
 *   **粗体** *斜体*      → bold / italic marks
 *
 * Returns null when the text contains no markup at all, so plain entries keep
 * the legacy plain-text storage with zero behavior change.
 */

interface InlineResult {
  nodes: RichContent[]
  hasMarks: boolean
}

const INLINE_PATTERN = /\*\*([^*]+)\*\*|\*([^*]+)\*/g

function parseInline(text: string): InlineResult {
  const nodes: RichContent[] = []
  let hasMarks = false
  let lastIndex = 0

  INLINE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      nodes.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    } else {
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'italic' }] })
    }
    hasMarks = true
    lastIndex = INLINE_PATTERN.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return { nodes, hasMarks }
}

function textBlock(type: string, text: string): { node: RichContent; hasMarks: boolean } {
  if (!text) return { node: { type }, hasMarks: false }
  const inline = parseInline(text)
  return { node: { type, content: inline.nodes }, hasMarks: inline.hasMarks }
}

const HEADING_RE = /^(#{2,3})\s+(.+)$/
const QUOTE_RE = /^>\s?/
const BULLET_RE = /^[-*]\s+/
const ORDERED_RE = /^\d+\.\s+/
const DIVIDER_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

export function parseComposerMarkup(text: string): RichContent | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: RichContent[] = []
  let hasMarkers = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const block = textBlock('heading', heading[2])
      block.node.attrs = { level: heading[1].length }
      blocks.push(block.node)
      hasMarkers = true
      index += 1
      continue
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: 'horizontalRule' })
      hasMarkers = true
      index += 1
      continue
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && QUOTE_RE.test(lines[index])) {
        quoteLines.push(lines[index].replace(QUOTE_RE, ''))
        index += 1
      }
      const content: RichContent[] = []
      quoteLines.forEach((quoteLine, lineIndex) => {
        if (lineIndex > 0) content.push({ type: 'hardBreak' })
        content.push(...parseInline(quoteLine).nodes)
      })
      blocks.push({ type: 'blockquote', content: [{ type: 'paragraph', content }] })
      hasMarkers = true
      continue
    }

    if (BULLET_RE.test(line)) {
      const items: RichContent[] = []
      while (index < lines.length && BULLET_RE.test(lines[index])) {
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(lines[index].replace(BULLET_RE, '')).nodes }],
        })
        index += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      hasMarkers = true
      continue
    }

    if (ORDERED_RE.test(line)) {
      const items: RichContent[] = []
      while (index < lines.length && ORDERED_RE.test(lines[index])) {
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(lines[index].replace(ORDERED_RE, '')).nodes }],
        })
        index += 1
      }
      blocks.push({ type: 'orderedList', content: items })
      hasMarkers = true
      continue
    }

    const block = textBlock('paragraph', line)
    if (block.hasMarks) hasMarkers = true
    blocks.push(block.node)
    index += 1
  }

  if (!hasMarkers) return null
  return { type: 'doc', content: blocks }
}

/**
 * Build the document to store for a composer save. Attached images are
 * appended as a trailing localImage group (with a trailing paragraph, same as
 * the full editor produces). Returns null only for plain text without images.
 */
export function buildComposerRichContent(text: string, mediaIds: string[]): RichContent | null {
  const parsed = parseComposerMarkup(text)
  if (mediaIds.length === 0) return parsed

  const base = parsed ?? plainTextToRichContent(text)
  const imageNodes: RichContent[] = mediaIds.map((mediaId) => ({
    type: 'localImage',
    attrs: { mediaId, alt: null, caption: null },
  }))
  return {
    type: 'doc',
    content: [...(base.content ?? []), ...imageNodes, { type: 'paragraph' }],
  }
}
