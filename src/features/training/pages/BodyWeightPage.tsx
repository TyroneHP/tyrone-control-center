import { useMemo, useState } from 'react'
import { InlineAlert, ResponsiveDialog } from '../../../design-system'
import {
  getBodyWeightSummary,
  getSevenDayBodyWeightTrend,
} from '../analytics/bodyWeightAnalytics'
import {
  isDateKeyInRange,
  resolveAnalyticsRange,
} from '../analytics/dateRangeAnalytics'
import { AnalyticsPeriodFilter } from '../components/AnalyticsPeriodFilter'
import { LineChart } from '../components/LineChart'
import type { BodyWeightEntry } from '../model/trainingTypes'
import { useTraining } from '../useTraining'

const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

interface BodyWeightDraft {
  date: string
  weight: string
  note: string
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00.000Z`))
}

function todayKey() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseWeight(value: string) {
  const normalized = value.trim().replace(',', '.')
  const weight = Number(normalized)
  return Number.isFinite(weight) ? weight : undefined
}

export function BodyWeightPage() {
  const {
    deleteBodyWeightEntry,
    loading,
    moveBodyWeightEntry,
    saveBodyWeightEntry,
    state,
    updateAnalyticsPreferences,
  } = useTraining()
  const [editing, setEditing] = useState<BodyWeightEntry>()
  const [draft, setDraft] = useState<BodyWeightDraft>()
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<BodyWeightEntry>()
  const [deleteError, setDeleteError] = useState<string>()
  const rangeResult = resolveAnalyticsRange(
    state.analyticsPreferences.range,
    new Date(),
    state.bodyWeightEntries.map(({ date }) => date),
  )
  const analytics = useMemo(() => {
    if (!rangeResult.valid) return undefined
    const entries = state.bodyWeightEntries.filter(({ date }) =>
      isDateKeyInRange(date, rangeResult.range),
    )
    return {
      summary: getBodyWeightSummary(state.bodyWeightEntries, rangeResult.range),
      trend: getSevenDayBodyWeightTrend(state.bodyWeightEntries, rangeResult.range),
      entries,
    }
  }, [rangeResult, state.bodyWeightEntries])

  const openCreate = () => {
    setEditing(undefined)
    setFormError(undefined)
    setDraft({ date: todayKey(), weight: '', note: '' })
  }
  const openEdit = (entry: BodyWeightEntry) => {
    setEditing(entry)
    setFormError(undefined)
    setDraft({ date: entry.date, weight: String(entry.weightKg).replace('.', ','), note: entry.note })
  }
  const closeForm = () => {
    if (pending) return
    setDraft(undefined)
    setEditing(undefined)
    setFormError(undefined)
  }
  const save = async () => {
    if (!draft || pending) return
    const weightKg = parseWeight(draft.weight)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setFormError('Bitte gib ein gültiges Datum an.')
      return
    }
    if (weightKg === undefined || weightKg < 20 || weightKg > 500 || Math.round(weightKg * 100) !== weightKg * 100) {
      setFormError('Bitte gib ein plausibles Gewicht zwischen 20 und 500 kg mit höchstens zwei Nachkommastellen an.')
      return
    }
    if (editing && state.bodyWeightEntries.some(({ id, date }) => id !== editing.id && date === draft.date)) {
      setFormError('Für dieses Datum besteht bereits eine Messung. Wähle ein anderes Datum.')
      return
    }
    setPending(true)
    setFormError(undefined)
    const input = { date: draft.date, weightKg, note: draft.note.trim() }
    const saved = editing
      ? await moveBodyWeightEntry(editing.id, input, new Date().toISOString())
      : await saveBodyWeightEntry(input, new Date().toISOString())
    setPending(false)
    if (!saved) {
      setFormError('Messung konnte nicht gespeichert werden. Bitte versuche es erneut.')
      return
    }
    closeForm()
  }
  const confirmDelete = async () => {
    if (!deleting || pending) return
    setPending(true)
    setDeleteError(undefined)
    const deleted = await deleteBodyWeightEntry(deleting.id)
    setPending(false)
    if (!deleted) {
      setDeleteError('Messung konnte nicht gelöscht werden. Bitte versuche es erneut.')
      return
    }
    setDeleting(undefined)
  }

  if (loading) return <p>Körpergewicht wird geladen …</p>

  return (
    <section aria-labelledby="bodyweight-heading" className="training-analytics-page">
      <header className="bodyweight-header">
        <div><h1 id="bodyweight-heading">Körpergewicht</h1><p>Messungen bleiben ausschließlich auf diesem Gerät.</p></div>
        <button className="button--primary" onClick={openCreate} type="button">Messung hinzufügen</button>
      </header>
      <AnalyticsPeriodFilter
        onChange={(range) => updateAnalyticsPreferences({ range })}
        value={state.analyticsPreferences.range}
      />
      {!rangeResult.valid ? <InlineAlert variant="error">{rangeResult.reason}</InlineAlert> : null}
      {analytics?.trend.length ? (
        <>
          <dl aria-label="Körpergewichtskennzahlen" className="analytics-metrics">
            <div><dt>Aktuelles Gewicht</dt><dd>{numberFormatter.format(analytics.summary.currentKg!)} kg</dd></div>
            <div><dt>Veränderung im Zeitraum</dt><dd>{numberFormatter.format(analytics.summary.changeInRangeKg!)} kg</dd></div>
            <div><dt>Zum vorherigen Wert</dt><dd>{analytics.summary.changeFromPreviousKg === undefined ? 'Keine Vergleichsmessung' : `${numberFormatter.format(analytics.summary.changeFromPreviousKg)} kg`}</dd></div>
            <div><dt>Niedrigster Wert</dt><dd>{numberFormatter.format(analytics.summary.minimumKg!)} kg</dd></div>
            <div><dt>Höchster Wert</dt><dd>{numberFormatter.format(analytics.summary.maximumKg!)} kg</dd></div>
            <div><dt>Messungen</dt><dd>{analytics.summary.measurementCount}</dd></div>
          </dl>
          <div className="bodyweight-chart-legend" aria-label="Diagrammlegende"><span>Rohwerte</span><span>7-Tage-Durchschnitt</span></div>
          <LineChart
            ariaLabel="Körpergewichtsverlauf"
            data={analytics.trend.map((point) => ({
              id: point.date, label: formatDate(point.date), value: point.rawKg,
              description: [state.bodyWeightEntries.find(({ date }) => date === point.date)?.note, `7-Tage-Durchschnitt ${numberFormatter.format(point.averageKg)} kg`].filter(Boolean).join(' · '),
            }))}
            secondaryData={analytics.trend.map((point) => ({ id: `average-${point.date}`, label: point.date, value: point.averageKg }))}
            secondaryLabel="7-Tage-Durchschnitt"
            unit="kg"
          />
          <ol aria-label="Körpergewichtsmessungen" className="bodyweight-list">
            {[...analytics.entries].sort((left, right) => right.date.localeCompare(left.date)).map((entry) => (
              <li key={entry.id}>
                <div><strong>{numberFormatter.format(entry.weightKg)} kg</strong><time dateTime={entry.date}>{formatDate(entry.date)}</time>{entry.note ? <span>{entry.note}</span> : null}</div>
                <div>
                  <button aria-label={`Messung vom ${formatDate(entry.date)} bearbeiten`} className="button--secondary" onClick={() => openEdit(entry)} type="button">Bearbeiten</button>
                  <button aria-label={`Messung vom ${formatDate(entry.date)} löschen`} className="button--danger" onClick={() => { setDeleteError(undefined); setDeleting(entry) }} type="button">Löschen</button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : <p>Noch keine Gewichtsmessungen im gewählten Zeitraum vorhanden.</p>}

      <ResponsiveDialog
        actions={<><button className="button--secondary" disabled={pending} onClick={closeForm} type="button">Abbrechen</button><button className="button--primary" disabled={pending} onClick={() => void save()} type="button">{pending ? 'Wird gespeichert …' : formError?.startsWith('Messung konnte') ? 'Erneut speichern' : 'Speichern'}</button></>}
        dismissible={!pending}
        onClose={closeForm}
        open={draft !== undefined}
        title={editing ? 'Messung bearbeiten' : 'Messung hinzufügen'}
      >
        {draft ? (
          <form className="bodyweight-form" onSubmit={(event) => { event.preventDefault(); void save() }}>
            <label>Datum<input disabled={pending} onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} /></label>
            <label>Gewicht in kg<input disabled={pending} inputMode="decimal" onChange={(event) => setDraft({ ...draft, weight: event.target.value })} type="text" value={draft.weight} /></label>
            <label>Notiz (optional)<textarea disabled={pending} onChange={(event) => setDraft({ ...draft, note: event.target.value })} value={draft.note} /></label>
            {formError ? <InlineAlert variant="error">{formError}</InlineAlert> : null}
          </form>
        ) : null}
      </ResponsiveDialog>
      <ResponsiveDialog
        actions={<><button className="button--secondary" disabled={pending} onClick={() => setDeleting(undefined)} type="button">Abbrechen</button><button className="button--danger" disabled={pending} onClick={() => void confirmDelete()} type="button">{pending ? 'Wird gelöscht …' : 'Endgültig löschen'}</button></>}
        dismissible={!pending}
        onClose={() => setDeleting(undefined)}
        open={deleting !== undefined}
        title="Messung wirklich löschen?"
      >
        <p>Diese lokale Gewichtsmessung wird dauerhaft gelöscht.</p>
        {deleteError ? <InlineAlert variant="error">{deleteError}</InlineAlert> : null}
      </ResponsiveDialog>
    </section>
  )
}
