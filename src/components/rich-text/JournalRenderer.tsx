import {
  Fragment,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RichContent } from '../../db/models'
import { mediaRepo } from '../../db/repository'
import type { PhotoRowsItem } from './PhotoRowsGallery'

const LazyPhotoRowsGallery = lazy(() =>
  import('./PhotoRowsGallery').then((module) => ({
    default: module.PhotoRowsGallery,
  })),
)

interface JournalRendererProps {
  content?: RichContent | null
  className?: string
}

interface ImageNodeAttributes {
  mediaId: string
  alt?: string
  caption?: string
}

type TopLevelSegment =
  | { kind: 'node'; node: RichContent; key: string }
  | { kind: 'images'; nodes: RichContent[]; key: string }

type ImageGroupLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      photos: PhotoRowsItem[]
      missingCount: number
      failedCount: number
    }

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function getImageAttributes(node: RichContent): ImageNodeAttributes {
  return {
    mediaId: optionalString(node.attrs?.mediaId) ?? '',
    alt: optionalString(node.attrs?.alt),
    caption: optionalString(node.attrs?.caption),
  }
}

function groupTopLevelNodes(nodes: RichContent[]): TopLevelSegment[] {
  const segments: TopLevelSegment[] = []
  let index = 0

  while (index < nodes.length) {
    const node = nodes[index]
    if (node.type !== 'localImage') {
      segments.push({ kind: 'node', node, key: `node-${index}` })
      index += 1
      continue
    }

    const start = index
    const images: RichContent[] = []
    while (index < nodes.length && nodes[index].type === 'localImage') {
      images.push(nodes[index])
      index += 1
    }
    segments.push({ kind: 'images', nodes: images, key: `images-${start}` })
  }

  return segments
}

function useImageGroup(nodes: readonly RichContent[]): ImageGroupLoadState {
  const [loadState, setLoadState] = useState<ImageGroupLoadState>({ status: 'loading' })

  useEffect(() => {
    let disposed = false
    const objectUrls: string[] = []
    const nodeAttributes = nodes.map(getImageAttributes)
    const uniqueMediaIds = Array.from(
      new Set(nodeAttributes.map(({ mediaId }) => mediaId).filter(Boolean)),
    )

    setLoadState({ status: 'loading' })

    void mediaRepo
      .getMany(uniqueMediaIds)
      .then((records) => {
        if (disposed) return

        const recordsById = new Map(records.map((record) => [record.id, record]))
        const urlsById = new Map<string, string>()
        let missingCount = 0
        let failedCount = 0

        for (const mediaId of uniqueMediaIds) {
          const media = recordsById.get(mediaId)
          if (!media?.blob) continue

          try {
            const objectUrl = URL.createObjectURL(media.blob)
            objectUrls.push(objectUrl)
            urlsById.set(mediaId, objectUrl)
          } catch {
            failedCount += 1
          }
        }

        if (disposed) {
          for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
          objectUrls.length = 0
          return
        }

        const photos: PhotoRowsItem[] = []
        nodeAttributes.forEach((attributes, index) => {
          const media = recordsById.get(attributes.mediaId)
          const src = urlsById.get(attributes.mediaId)
          if (!attributes.mediaId || !media) {
            missingCount += 1
            return
          }
          if (!src) return

          photos.push({
            key: `${attributes.mediaId}-${index}`,
            mediaId: attributes.mediaId,
            src,
            width: positiveDimension(media.width),
            height: positiveDimension(media.height),
            alt: attributes.alt ?? '',
            caption: attributes.caption,
          })
        })

        setLoadState({
          status: 'ready',
          photos,
          missingCount,
          failedCount,
        })
      })
      .catch(() => {
        if (!disposed) setLoadState({ status: 'error' })
      })

    return () => {
      disposed = true
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
    }
  }, [nodes])

  return loadState
}

function ImagePlaceholder({ kind }: { kind: 'loading' | 'missing' | 'error' }) {
  const label =
    kind === 'loading'
      ? '正在加载图片'
      : kind === 'missing'
        ? '图片不存在'
        : '图片加载失败'

  return (
    <div className={`journal-image-placeholder is-${kind}`} role="img" aria-label={label}>
      {kind === 'loading' ? '正在加载图片…' : label}
    </div>
  )
}

function JournalPhoto({ photo }: { photo: PhotoRowsItem }) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className="journal-image-figure">
      {failed ? (
        <ImagePlaceholder kind="error" />
      ) : (
        <img
          className="journal-image"
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt ?? ''}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {photo.caption ? (
        <figcaption className="journal-image-caption">{photo.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function pairLayoutClass(photos: readonly PhotoRowsItem[]): string {
  const firstPortrait = photos[0].height > photos[0].width
  const secondPortrait = photos[1].height > photos[1].width

  if (firstPortrait && secondPortrait) return 'is-portrait-pair'
  if (!firstPortrait && !secondPortrait) return 'is-landscape-pair'
  return 'is-mixed-pair'
}

function LoadedImageGroup({ photos }: { photos: readonly PhotoRowsItem[] }) {
  if (photos.length === 1) {
    return (
      <div className="journal-image-layout journal-image-single">
        <JournalPhoto photo={photos[0]} />
      </div>
    )
  }

  if (photos.length === 2) {
    return (
      <div className={`journal-image-layout journal-image-pair ${pairLayoutClass(photos)}`}>
        {photos.map((photo) => (
          <JournalPhoto key={photo.key} photo={photo} />
        ))}
      </div>
    )
  }

  return (
    <div className="journal-image-layout journal-image-rows">
      <Suspense
        fallback={
          <div className="journal-gallery-loading" aria-label="正在排版图片">
            {photos.map((photo) => (
              <ImagePlaceholder key={photo.key} kind="loading" />
            ))}
          </div>
        }
      >
        <LazyPhotoRowsGallery photos={photos} />
      </Suspense>
    </div>
  )
}

function JournalImageGroup({ nodes }: { nodes: readonly RichContent[] }) {
  const loadState = useImageGroup(nodes)

  if (loadState.status === 'loading') {
    return (
      <div className="journal-image-group is-loading" aria-busy="true">
        {nodes.map((_, index) => (
          <ImagePlaceholder key={index} kind="loading" />
        ))}
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className="journal-image-group has-error">
        <ImagePlaceholder kind="error" />
      </div>
    )
  }

  return (
    <div className="journal-image-group">
      {loadState.photos.length > 0 ? <LoadedImageGroup photos={loadState.photos} /> : null}
      {Array.from({ length: loadState.missingCount }, (_, index) => (
        <ImagePlaceholder key={`missing-${index}`} kind="missing" />
      ))}
      {Array.from({ length: loadState.failedCount }, (_, index) => (
        <ImagePlaceholder key={`error-${index}`} kind="error" />
      ))}
    </div>
  )
}

function renderMarkedText(node: RichContent): ReactNode {
  let rendered: ReactNode = node.text ?? ''

  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') {
      rendered = <strong>{rendered}</strong>
    } else if (mark.type === 'italic') {
      rendered = <em>{rendered}</em>
    }
  }

  return rendered
}

function renderChildren(node: RichContent, path: string): ReactNode[] {
  return (node.content ?? []).map((child, index) =>
    renderRichNode(child, `${path}-${index}`),
  )
}

function renderRichNode(node: RichContent, key: string): ReactNode {
  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{renderChildren(node, key)}</Fragment>
    case 'text':
      return <Fragment key={key}>{renderMarkedText(node)}</Fragment>
    case 'paragraph':
      return (
        <p key={key} className="journal-paragraph">
          {renderChildren(node, key)}
        </p>
      )
    case 'heading': {
      const children = renderChildren(node, key)
      return node.attrs?.level === 2 ? (
        <h2 key={key} className="journal-heading journal-heading-2">
          {children}
        </h2>
      ) : (
        <h3 key={key} className="journal-heading journal-heading-3">
          {children}
        </h3>
      )
    }
    case 'h2':
      return (
        <h2 key={key} className="journal-heading journal-heading-2">
          {renderChildren(node, key)}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={key} className="journal-heading journal-heading-3">
          {renderChildren(node, key)}
        </h3>
      )
    case 'blockquote':
      return (
        <blockquote key={key} className="journal-blockquote">
          {renderChildren(node, key)}
        </blockquote>
      )
    case 'bulletList':
      return (
        <ul key={key} className="journal-list journal-bullet-list">
          {renderChildren(node, key)}
        </ul>
      )
    case 'orderedList': {
      const start = node.attrs?.start
      return (
        <ol
          key={key}
          className="journal-list journal-ordered-list"
          start={typeof start === 'number' && start > 0 ? start : undefined}
        >
          {renderChildren(node, key)}
        </ol>
      )
    }
    case 'listItem':
      return (
        <li key={key} className="journal-list-item">
          {renderChildren(node, key)}
        </li>
      )
    case 'horizontalRule':
    case 'hr':
      return <hr key={key} className="journal-divider" />
    case 'hardBreak':
      return <br key={key} />
    case 'localImage':
      return <JournalImageGroup key={key} nodes={[node]} />
    default:
      return <Fragment key={key}>{renderChildren(node, key)}</Fragment>
  }
}

export function JournalRenderer({ content, className }: JournalRendererProps) {
  const segments = useMemo(() => {
    if (!content) return []
    const topLevelNodes = content.type === 'doc' ? (content.content ?? []) : [content]
    return groupTopLevelNodes(topLevelNodes)
  }, [content])

  const rendererClassName = className
    ? `journal-renderer ${className}`
    : 'journal-renderer'

  return (
    <div className={rendererClassName}>
      {segments.map((segment) =>
        segment.kind === 'images' ? (
          <JournalImageGroup key={segment.key} nodes={segment.nodes} />
        ) : (
          renderRichNode(segment.node, segment.key)
        ),
      )}
    </div>
  )
}
