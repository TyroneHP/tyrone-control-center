import { useState } from 'react'
import { ResponsiveDialog } from '../../../design-system'
import type { TrainingContextValue } from '../trainingContext'
import { TrainingDataCorruptionError } from '../persistence/trainingMigrations'
import { useTraining } from '../useTraining'

function downloadRawTrainingData(raw: string) {
  const url = URL.createObjectURL(
    new Blob([raw], { type: 'application/json;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.download = 'coregrid-trainingsdaten.json'
  link.href = url
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function CorruptionRecoveryDialog({
  exportRaw,
  reset,
}: Pick<TrainingContextValue, 'exportRaw' | 'reset'>) {
  const [dismissed, setDismissed] = useState(false)
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const exportData = async () => {
    if (exportPending) return
    setExportPending(true)
    setExportError(undefined)
    try {
      downloadRawTrainingData(await exportRaw())
    } catch {
      setExportError('Die Rohdaten konnten nicht exportiert werden.')
    } finally {
      setExportPending(false)
    }
  }

  const confirmReset = async () => {
    if (resetPending) return
    setResetPending(true)
    try {
      await reset()
      setResetConfirmationOpen(false)
    } finally {
      setResetPending(false)
    }
  }

  return (
    <>
      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              disabled={exportPending || resetPending}
              onClick={() => setDismissed(true)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--secondary"
              disabled={exportPending || resetPending}
              onClick={() => void exportData()}
              type="button"
            >
              {exportPending ? 'Export wird vorbereitet …' : 'Rohdaten exportieren'}
            </button>
            <button
              className="button--danger"
              disabled={exportPending || resetPending}
              onClick={() => setResetConfirmationOpen(true)}
              type="button"
            >
              Trainingsbereich zurücksetzen
            </button>
          </>
        }
        dismissible={false}
        onClose={() => setDismissed(true)}
        open={!dismissed}
        title="Trainingsdaten wiederherstellen"
      >
        <p>
          Deine gespeicherten Trainingsdaten sind beschädigt. Trainingseingaben
          bleiben blockiert, bis du die Rohdaten exportierst oder den
          Trainingsbereich zurücksetzt.
        </p>
        {exportError ? <p role="alert">{exportError}</p> : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        actions={
          <>
            <button
              className="button--secondary"
              disabled={resetPending}
              onClick={() => setResetConfirmationOpen(false)}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="button--danger"
              disabled={resetPending}
              onClick={() => void confirmReset()}
              type="button"
            >
              {resetPending ? 'Wird zurückgesetzt …' : 'Zurücksetzen bestätigen'}
            </button>
          </>
        }
        dismissible={!resetPending}
        onClose={() => {
          if (!resetPending) setResetConfirmationOpen(false)
        }}
        open={!dismissed && resetConfirmationOpen}
        title="Trainingsbereich zurücksetzen?"
      >
        <p>
          Alle Trainingsvorlagen, aktiven Trainings und Verläufe auf diesem
          Gerät werden gelöscht. Dieser Schritt kann nicht rückgängig gemacht
          werden.
        </p>
      </ResponsiveDialog>
    </>
  )
}

export function TrainingRecoveryDialog() {
  const { exportRaw, recoveryError, reset } = useTraining()
  if (!(recoveryError instanceof TrainingDataCorruptionError)) return null

  return (
    <CorruptionRecoveryDialog
      exportRaw={exportRaw}
      key={`${recoveryError.name}:${recoveryError.message}`}
      reset={reset}
    />
  )
}
