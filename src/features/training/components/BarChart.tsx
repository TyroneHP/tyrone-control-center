import { useId, useState } from 'react'
import type { ChartDatum } from './LineChart'

export interface BarChartProps {
  ariaLabel: string
  data: readonly ChartDatum[]
  unit: string
  onSelect?: (point: ChartDatum) => void
}

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
})

export function BarChart({ ariaLabel, data, onSelect, unit }: BarChartProps) {
  const titleId = useId()
  const [selected, setSelected] = useState<ChartDatum>()
  if (data.length === 0) return <p>Keine Diagrammdaten vorhanden.</p>
  const maximum = Math.max(...data.map(({ value }) => value), 1)
  const barWidth = 80 / data.length
  const label = (point: ChartDatum) =>
    `${point.label}: ${numberFormatter.format(point.value)} ${unit}`
  const select = (point: ChartDatum) => {
    setSelected(point)
    onSelect?.(point)
  }

  return (
    <figure className="analytics-chart">
      <svg aria-labelledby={titleId} preserveAspectRatio="none" role="img" viewBox="0 0 100 100">
        <title id={titleId}>{ariaLabel}</title>
        {data.map((point, index) => {
          const height = (point.value / maximum) * 80
          return (
            <rect
              className="analytics-chart__bar"
              height={height}
              key={point.id}
              width={Math.max(2, barWidth - 2)}
              x={10 + index * barWidth}
              y={92 - height}
            />
          )
        })}
      </svg>
      <ol aria-label={`Werte: ${ariaLabel}`} className="analytics-chart__values">
        {data.map((point) => (
          <li key={point.id}>
            <button
              onClick={() => select(point)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') select(point)
              }}
              type="button"
            >
              {label(point)}
            </button>
          </li>
        ))}
      </ol>
      {selected ? <p role="status">{label(selected)}</p> : null}
    </figure>
  )
}
