export const FOCUS_COMPOSER_EVENT = 'echo-journal:focus-composer'
export const LOCAL_MEDIA_UPDATED_EVENT = 'echo-journal:local-media-updated'

// Pending-intent bridge: lets the header ask the (possibly not-yet-mounted)
// timeline composer to take focus after a cross-page navigation.
let composerFocusPending = false

export function requestComposerFocus(): void {
  composerFocusPending = true
  window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT))
}

export function consumeComposerFocusRequest(): boolean {
  const pending = composerFocusPending
  composerFocusPending = false
  return pending
}
