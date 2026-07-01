interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  positive: boolean
}

export function Sparkline({ values, width = 100, height = 32, positive }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="text-slate-600 text-xs">--</div>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#16a34a' : '#dc2626'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
