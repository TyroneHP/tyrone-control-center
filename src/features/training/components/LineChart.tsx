import { useId, useMemo, useState } from 'react'

export interface ChartDatum {
  id: string
  label: string
  value: number
  description?: string
}

export interface LineChartProps {
  ariaLabel: string
  data: readonly ChartDatum[]
  unit: string
  onSelect?: (point: ChartDatum) => void
  secondaryData?: readonly ChartDatum[]
  secondaryLabel?: string
}

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
})

function reduceVisualPoints(data: readonly ChartDatum[]) {
  if (data.length <= 500) return [...data]
  const selected = new Set<ChartDatum>([data[0], data[data.length - 1]])
  const bucketSize = Math.ceil(data.length / 250)
  for (let index = 0; index < data.length; index += bucketSize) {
    const bucket = data.slice(index, index + bucketSize)
    selected.add(bucket.reduce((minimum, point) => point.value < minimum.value ? point : minimum))
    selected.add(bucket.reduce((maximum, point) => point.value > maximum.value ? point : maximum))
  }
  return data.filter((point) => selected.has(point))
}

export function LineChart({ ariaLabel, data, onSelect, secondaryData = [], secondaryLabel, unit }: LineChartProps) {
  const titleId = useId()
  const descriptionId = useId()
  const [selected, setSelected] = useState<ChartDatum>()
  const visual = useMemo(() => reduceVisualPoints(data), [data])
  if (data.length === 0) return <p>Keine Diagrammdaten vorhanden.</p>

  const secondaryVisual = reduceVisualPoints(secondaryData)
  const allValues = [...visual, ...secondaryVisual].map(({ value }) => value)
  const minimum = Math.min(...allValues)
  const maximum = Math.max(...allValues)
  const span = maximum - minimum || 1
  const coordinates = visual.map((point, index) => ({
    point,
    x: visual.length === 1 ? 50 : (index / (visual.length - 1)) * 100,
    y: 92 - ((point.value - minimum) / span) * 80,
  }))
  const secondaryCoordinates = secondaryVisual.map((point, index) => ({
    point,
    x: secondaryVisual.length === 1 ? 50 : (index / (secondaryVisual.length - 1)) * 100,
    y: 92 - ((point.value - minimum) / span) * 80,
  }))
  const select = (point: ChartDatum) => {
    setSelected(point)
    onSelect?.(point)
  }
  const valueLabel = (point: ChartDatum) =>
    `${point.label}: ${numberFormatter.format(point.value)} ${unit}`

  return (
    <figure className="analytics-chart">
      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        <title id={titleId}>{ariaLabel}</title>
        <desc id={descriptionId}>Liniendiagramm mit {data.length} Datenpunkten.</desc>
        <polyline
          className="analytics-chart__line"
          fill="none"
          points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
        />
        {secondaryCoordinates.length ? (
          <polyline
            aria-label={secondaryLabel}
            className="analytics-chart__line analytics-chart__line--secondary"
            fill="none"
            points={secondaryCoordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
          />
        ) : null}
        {coordinates.map(({ point, x, y }) => (
          <circle className="analytics-chart__point" cx={x} cy={y} key={point.id} r="2.5" />
        ))}
      </svg>
      <ol aria-label={`Werte: ${ariaLabel}`} className="analytics-chart__values">
        {data.map((point) => (
          <li key={point.id}>
            <button
              type="button"
              onClick={() => select(point)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') select(point)
              }}
            >
              {valueLabel(point)}
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
        <p role="status">
          {valueLabel(selected)}{selected.description ? ` – ${selected.description}` : ''}
        </p>
      ) : null}
    </figure>
  )
}
