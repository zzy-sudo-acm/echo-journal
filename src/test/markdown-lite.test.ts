import { describe, expect, it } from 'vitest'
import { buildComposerRichContent, parseComposerMarkup } from '../services/markdownLite'
import type { RichContent } from '../db/models'

function firstBlock(doc: RichContent): RichContent {
  return doc.content![0]
}

describe('parseComposerMarkup', () => {
  it('returns null for plain text (legacy plain storage)', () => {
    expect(parseComposerMarkup('今天天气不错，随便写两句。')).toBeNull()
    expect(parseComposerMarkup('第一行\n第二行\n\n第三行')).toBeNull()
    expect(parseComposerMarkup('')).toBeNull()
  })

  it('parses ## and ### headings', () => {
    const doc = parseComposerMarkup('## 大标题\n### 小标题')!
    expect(doc.type).toBe('doc')
    expect(firstBlock(doc)).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '大标题' }],
    })
    expect(doc.content![1]).toMatchObject({ type: 'heading', attrs: { level: 3 } })
  })

  it('parses consecutive quote lines into one blockquote with hardBreaks', () => {
    const doc = parseComposerMarkup('> 第一行\n> 第二行\n普通段落')!
    const quote = firstBlock(doc)
    expect(quote.type).toBe('blockquote')
    const paragraph = quote.content![0]
    expect(paragraph.content).toEqual([
      { type: 'text', text: '第一行' },
      { type: 'hardBreak' },
      { type: 'text', text: '第二行' },
    ])
    expect(doc.content![1]).toMatchObject({ type: 'paragraph' })
  })

  it('parses bullet and ordered lists', () => {
    const doc = parseComposerMarkup('- 苹果\n- 香蕉\n1. 先这样\n2. 再那样')!
    const bullets = firstBlock(doc)
    expect(bullets.type).toBe('bulletList')
    expect(bullets.content).toHaveLength(2)
    expect(bullets.content![0]).toMatchObject({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '苹果' }] }],
    })
    const ordered = doc.content![1]
    expect(ordered.type).toBe('orderedList')
    expect(ordered.content).toHaveLength(2)
  })

  it('parses dividers', () => {
    for (const marker of ['---', '***', '___']) {
      const doc = parseComposerMarkup(`上文\n${marker}\n下文`)!
      expect(doc.content![1].type).toBe('horizontalRule')
    }
  })

  it('parses bold and italic marks inline', () => {
    const doc = parseComposerMarkup('这句有**重点**和*强调*。')!
    expect(firstBlock(doc).content).toEqual([
      { type: 'text', text: '这句有' },
      { type: 'text', text: '重点', marks: [{ type: 'bold' }] },
      { type: 'text', text: '和' },
      { type: 'text', text: '强调', marks: [{ type: 'italic' }] },
      { type: 'text', text: '。' },
    ])
  })

  it('keeps unmatched markers as plain text', () => {
    expect(parseComposerMarkup('星号*没闭合就原样保留')).toBeNull()
  })

  it('does not treat a single # as a heading', () => {
    expect(parseComposerMarkup('# 一级标题不支持')).toBeNull()
  })
})

describe('buildComposerRichContent', () => {
  it('returns null for plain text without images', () => {
    expect(buildComposerRichContent('纯文本', [])).toBeNull()
  })

  it('appends images after plain text and forces rich storage', () => {
    const doc = buildComposerRichContent('今天的云', ['m1', 'm2'])!
    expect(doc.type).toBe('doc')
    const types = doc.content!.map((node) => node.type)
    expect(types).toEqual(['paragraph', 'localImage', 'localImage', 'paragraph'])
    expect(doc.content![1].attrs).toMatchObject({ mediaId: 'm1' })
  })

  it('supports image-only entries', () => {
    const doc = buildComposerRichContent('', ['only-image'])!
    const imageNodes = doc.content!.filter((node) => node.type === 'localImage')
    expect(imageNodes).toHaveLength(1)
    expect(imageNodes[0].attrs).toMatchObject({ mediaId: 'only-image' })
  })

  it('keeps parsed blocks ahead of the image group', () => {
    const doc = buildComposerRichContent('## 标题\n> 引用', ['m9'])!
    const types = doc.content!.map((node) => node.type)
    expect(types).toEqual(['heading', 'blockquote', 'localImage', 'paragraph'])
  })
})
