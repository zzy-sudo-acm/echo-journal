import { Suspense, lazy } from 'react'
import type { EntryEditorProps } from './EntryEditor'

const RichEntryEditor = lazy(() =>
  import('./EntryEditor').then((module) => ({ default: module.EntryEditor })),
)

export function LazyEntryEditor(props: EntryEditorProps) {
  return (
    <Suspense
      fallback={(
        <div className="modal-overlay editor-overlay" aria-busy="true">
          <div className="modal editor-modal editor-loading">正在打开日记…</div>
        </div>
      )}
    >
      <RichEntryEditor {...props} />
    </Suspense>
  )
}
