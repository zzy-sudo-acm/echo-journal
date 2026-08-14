/* oxlint-disable react/only-export-components -- Tiptap registers the colocated React NodeView through this extension. */
import { useEffect, useState } from 'react'
import { Node, mergeAttributes, type Attributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react'
import { acquireMediaUrl } from '../../services/mediaCache'
import { LOCAL_MEDIA_UPDATED_EVENT } from '../../utils/events'

export interface LocalImageAttributes {
  mediaId: string
  alt?: string | null
  caption?: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    localImage: {
      setLocalImage: (attributes: LocalImageAttributes) => ReturnType
    }
  }
}

type LocalImageLoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; url: string; width: number; height: number }

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function LocalImageNodeView({ node, selected }: ReactNodeViewProps) {
  const mediaId = optionalString(node.attrs.mediaId) ?? ''
  const alt = optionalString(node.attrs.alt) ?? ''
  const caption = optionalString(node.attrs.caption)
  const [loadState, setLoadState] = useState<LocalImageLoadState>({ status: 'loading' })
  const [mediaRevision, setMediaRevision] = useState(0)

  useEffect(() => {
    const handleMediaUpdated = (event: Event) => {
      if ((event as CustomEvent<unknown>).detail === mediaId) {
        setMediaRevision((revision) => revision + 1)
      }
    }

    window.addEventListener(LOCAL_MEDIA_UPDATED_EVENT, handleMediaUpdated)
    return () => window.removeEventListener(LOCAL_MEDIA_UPDATED_EVENT, handleMediaUpdated)
  }, [mediaId])

  useEffect(() => {
    let disposed = false

    if (!mediaId) {
      setLoadState({ status: 'missing' })
      return () => {
        disposed = true
      }
    }

    setLoadState({ status: 'loading' })

    const { promise, release } = acquireMediaUrl(mediaId)
    void promise
      .then((media) => {
        if (disposed) return
        if (!media) {
          setLoadState({ status: 'missing' })
          return
        }

        setLoadState({
          status: 'ready',
          url: media.url,
          width: media.width,
          height: media.height,
        })
      })
      .catch(() => {
        if (!disposed) setLoadState({ status: 'error' })
      })

    return () => {
      disposed = true
      release()
    }
  }, [mediaId, mediaRevision])

  return (
    <NodeViewWrapper
      as="figure"
      className={`local-image-node ${selected ? 'is-selected' : ''}`}
      data-drag-handle
    >
      <div className="local-image-frame" contentEditable={false}>
        {loadState.status === 'ready' ? (
          <img
            className="local-image-preview"
            src={loadState.url}
            alt={alt}
            width={loadState.width}
            height={loadState.height}
            decoding="async"
            onError={() => setLoadState({ status: 'error' })}
          />
        ) : (
          <div
            className={`local-image-placeholder is-${loadState.status}`}
            role="img"
            aria-label={
              loadState.status === 'loading'
                ? '正在加载图片'
                : loadState.status === 'missing'
                  ? '图片不存在'
                  : '图片加载失败'
            }
          >
            {loadState.status === 'loading'
              ? '正在加载图片…'
              : loadState.status === 'missing'
                ? '图片不存在'
                : '图片加载失败'}
          </div>
        )}
      </div>
      {caption ? (
        <figcaption className="local-image-caption" contentEditable={false}>
          {caption}
        </figcaption>
      ) : null}
    </NodeViewWrapper>
  )
}

function attribute(
  dataAttribute: 'data-media-id' | 'data-alt' | 'data-caption',
): Attributes[string] {
  return {
    default: null,
    parseHTML: (element) => element.getAttribute(dataAttribute),
    renderHTML: (attributes) => {
      const value = optionalString(attributes[
        dataAttribute === 'data-media-id'
          ? 'mediaId'
          : dataAttribute === 'data-alt'
            ? 'alt'
            : 'caption'
      ])
      return value ? { [dataAttribute]: value } : {}
    },
  }
}

export const localImageExtension = Node.create({
  name: 'localImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      mediaId: attribute('data-media-id'),
      alt: attribute('data-alt'),
      caption: attribute('data-caption'),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-local-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-local-image': '' })]
  },

  addCommands() {
    return {
      setLocalImage:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              mediaId: attributes.mediaId,
              alt: attributes.alt ?? null,
              caption: attributes.caption ?? null,
            },
          }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(LocalImageNodeView)
  },
})
