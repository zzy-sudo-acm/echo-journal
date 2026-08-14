export const OPEN_FULL_EDITOR_EVENT = 'echo-journal:open-full-editor'
export const LOCAL_MEDIA_UPDATED_EVENT = 'echo-journal:local-media-updated'

// Pending-intent bridge: lets the header ask the (possibly not-yet-mounted)
// timeline page to open the full editor after a cross-page navigation.
let fullEditorOpenPending = false

export function requestFullEditorOpen(): void {
  fullEditorOpenPending = true
  window.dispatchEvent(new Event(OPEN_FULL_EDITOR_EVENT))
}

export function consumeFullEditorOpenRequest(): boolean {
  const pending = fullEditorOpenPending
  fullEditorOpenPending = false
  return pending
}
