import { useState, type ComponentPropsWithoutRef } from 'react'
import {
  RowsPhotoAlbum,
  type ComponentsProps,
  type Photo,
  type Render,
  type RenderImageProps,
} from 'react-photo-album'
import 'react-photo-album/rows.css'

export interface PhotoRowsItem extends Photo {
  mediaId: string
  caption?: string
}

interface PhotoRowsGalleryProps {
  photos: readonly PhotoRowsItem[]
}

function AlbumImage({ alt, ...imageProps }: RenderImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className="journal-gallery-image-placeholder is-error"
        role="img"
        aria-label={alt ? `${alt}加载失败` : '图片加载失败'}
      >
        图片加载失败
      </span>
    )
  }

  return <img {...imageProps} alt={alt} onError={() => setFailed(true)} />
}

function renderAlbumImage(props: RenderImageProps) {
  return <AlbumImage {...props} />
}

function renderAlbumExtras(
  _props: object,
  { photo }: { photo: PhotoRowsItem },
) {
  return photo.caption ? (
    <span className="journal-gallery-caption">{photo.caption}</span>
  ) : null
}

const albumRender: Render<PhotoRowsItem> = {
  image: renderAlbumImage,
  extras: renderAlbumExtras,
}

const albumComponentProps: ComponentsProps<PhotoRowsItem> = {
  container: { className: 'journal-photo-album' },
  track: { className: 'journal-photo-album-row' },
  wrapper: { className: 'journal-photo-album-item' },
  image: {
    className: 'journal-gallery-image',
    loading: 'lazy',
    decoding: 'async',
  } satisfies ComponentPropsWithoutRef<'img'>,
}

function gallerySpacing(containerWidth: number): number {
  return containerWidth < 520 ? 4 : 8
}

function targetRowHeight(containerWidth: number): number {
  return containerWidth < 520 ? 136 : 210
}

export function PhotoRowsGallery({ photos }: PhotoRowsGalleryProps) {
  return (
    <RowsPhotoAlbum<PhotoRowsItem>
      photos={photos}
      spacing={gallerySpacing}
      targetRowHeight={targetRowHeight}
      rowConstraints={{ singleRowMaxHeight: 280 }}
      render={albumRender}
      componentsProps={albumComponentProps}
    />
  )
}
