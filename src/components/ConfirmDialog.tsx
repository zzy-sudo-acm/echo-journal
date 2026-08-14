import { Dialog } from './ui/Overlay'

interface ConfirmDialogProps {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      onClose={() => {
        // A confirm-in-progress refuses to close; the back stack must not
        // treat it as closing (it unmounts when the operation settles).
        if (confirming) return false
        onCancel()
        return true
      }}
      role="alertdialog"
      ariaLabel={message}
    >
      <p>{message}</p>
      <div className="btn-group">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? '执行中…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
