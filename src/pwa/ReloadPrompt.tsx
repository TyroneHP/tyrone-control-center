import { useRegisterSW } from 'virtual:pwa-register/react'
import './reloadPrompt.css'

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null

  return (
    <aside aria-live="polite" className="reload-prompt">
      <div>
        <strong>
          {needRefresh
            ? 'Eine neue Version ist verfügbar.'
            : 'Die App ist jetzt offline verfügbar.'}
        </strong>
        <span>
          {needRefresh
            ? 'Deine aktuelle Ansicht bleibt bestehen, bis du die Aktualisierung bestätigst.'
            : 'Die Anwendung kann nach diesem Besuch ohne Verbindung erneut geöffnet werden.'}
        </span>
      </div>
      <div className="reload-prompt__actions">
        {needRefresh ? (
          <>
            <button
              className="reload-prompt__later"
              onClick={() => setNeedRefresh(false)}
              type="button"
            >
              Später
            </button>
            <button
              onClick={() => void updateServiceWorker(true)}
              type="button"
            >
              Aktualisieren
            </button>
          </>
        ) : (
          <button onClick={() => setOfflineReady(false)} type="button">
            Schließen
          </button>
        )}
      </div>
    </aside>
  )
}
