import type { ReactNode } from 'react'
import { ResponsiveDialog } from '../../../../design-system'

export interface TrainingBottomSheetProps {
  actions?: ReactNode
  children: ReactNode
  dismissible?: boolean
  onClose: () => void
  open: boolean
  title: string
}

export function TrainingBottomSheet({
  actions,
  children,
  dismissible = true,
  onClose,
  open,
  title,
}: TrainingBottomSheetProps) {
  return (
    <ResponsiveDialog
      actions={actions}
      dismissible={dismissible}
      onClose={onClose}
      open={open}
      title={title}
    >
      <div className="training-sheet__content">{children}</div>
    </ResponsiveDialog>
  )
}
