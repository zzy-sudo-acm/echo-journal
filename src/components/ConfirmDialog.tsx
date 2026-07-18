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
    <div className="confirm-overlay" onClick={(event) => { event.stopPropagation(); onCancel() }}>
      <div className="confirm-box" role="alertdialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <p>{message}</p>
        <div className="btn-group">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </button>
          <button type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? '执行中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
