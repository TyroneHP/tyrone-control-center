import { ResponsiveDialog } from '../../../design-system'

export interface FinishDiscardSheetProps {
  action: 'discard' | 'finish'
  onClose: () => void
  onConfirm: () => void
  open: boolean
}

const CONTENT = {
  discard: {
    confirmLabel: 'Endgültig verwerfen',
    description: 'Alle Eingaben dieses aktiven Trainings gehen verloren.',
    title: 'Training wirklich verwerfen?',
  },
  finish: {
    confirmLabel: 'Training abschließen',
    description: 'Das Training wird nur in dieser Demo beendet und nicht im Verlauf gespeichert.',
    title: 'Training abschließen?',
  },
} as const

export function FinishDiscardSheet({
  action,
  onClose,
  onConfirm,
  open,
}: FinishDiscardSheetProps) {
  const content = CONTENT[action]

  return (
    <ResponsiveDialog
      actions={
        <>
          <button onClick={onClose} type="button">Abbrechen</button>
          <button
            className={action === 'discard' ? 'button--danger' : 'button--primary'}
            onClick={onConfirm}
            type="button"
          >
            {content.confirmLabel}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={content.title}
    >
      <p>{content.description}</p>
    </ResponsiveDialog>
  )
}
