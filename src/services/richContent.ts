import type { Entry, RichContent } from '../db/models'

type RichContentHolder = Pick<Entry, 'richContent'> | { richContent?: RichContent | null }
type MediaIdMap = ReadonlyMap<string, string> | Readonly<Record<string, string>>

const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'codeBlock',
  'horizontalRule',
  'localImage',
  'image',
])

/** Convert a legacy plain-text entry into a minimal, valid Tiptap document. */
export function plainTextToRichContent(text: string): RichContent {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
}

/**
 * Derive the searchable/copyable plain-text representation of a Tiptap document.
 * Image captions are included, while image identifiers and other JSON attributes are not.
 */
export function extractPlainText(content?: RichContent | null): string {
  if (!content) return ''

  const chunks: string[] = []

  const visit = (node: RichContent): void => {
    if (node.type === 'text' && typeof node.text === 'string') {
      chunks.push(node.text)
      return
    }

    if (node.type === 'hardBreak') {
      chunks.push('\n')
      return
    }

    const caption = node.attrs?.caption
    if (
      (node.type === 'localImage' || node.type === 'image') &&
      typeof caption === 'string' &&
      caption.trim()
    ) {
      chunks.push(caption.trim())
    }

    for (const child of node.content ?? []) visit(child)

    if (node.type && TEXT_BLOCK_TYPES.has(node.type)) chunks.push('\n')
  }

  visit(content)

  return chunks
    .join('')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}

/** Return unique local-media identifiers in document order. */
export function collectMediaIds(content?: RichContent | null): string[] {
  if (!content) return []

  const ids = new Set<string>()
  const visit = (node: RichContent): void => {
    const mediaId = node.attrs?.mediaId
    if (typeof mediaId === 'string' && mediaId) ids.add(mediaId)
    for (const child of node.content ?? []) visit(child)
  }

  visit(content)
  return [...ids]
}

function replacementFor(idMap: MediaIdMap, mediaId: string): string | undefined {
  if (idMap instanceof Map) return idMap.get(mediaId)
  const record = idMap as Readonly<Record<string, string>>
  return Object.prototype.hasOwnProperty.call(record, mediaId) ? record[mediaId] : undefined
}

/** Immutably rewrite local-media identifiers, for example while resolving import conflicts. */
export function rewriteMediaIds(
  content: RichContent | undefined,
  idMap: MediaIdMap,
): RichContent | undefined {
  if (!content) return undefined

  const rewrite = (node: RichContent): RichContent => {
    let changed = false
    let attrs = node.attrs
    const mediaId = attrs?.mediaId

    if (typeof mediaId === 'string') {
      const replacement = replacementFor(idMap, mediaId)
      if (replacement && replacement !== mediaId) {
        attrs = { ...attrs, mediaId: replacement }
        changed = true
      }
    }

    let children = node.content
    if (children) {
      const rewrittenChildren = children.map(rewrite)
      if (rewrittenChildren.some((child, index) => child !== children?.[index])) {
        children = rewrittenChildren
        changed = true
      }
    }

    return changed ? { ...node, attrs, content: children } : node
  }

  return rewrite(content)
}

export function hasRichContent(value: RichContent | null | undefined): value is RichContent
export function hasRichContent<T extends RichContentHolder>(
  value: T,
): value is T & { richContent: RichContent }
export function hasRichContent(
  value: RichContentHolder | RichContent | null | undefined,
): boolean {
  if (!value || typeof value !== 'object') return false
  const candidate = 'richContent' in value ? value.richContent : value
  return Boolean(candidate && typeof candidate === 'object' && candidate.type === 'doc')
}
