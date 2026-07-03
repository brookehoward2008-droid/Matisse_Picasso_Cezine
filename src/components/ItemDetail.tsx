import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AlertDirection, AlertRow, PriceTick, TickerRow } from '../types'
import { formatCurrency } from '../lib/session'

interface ItemDetailProps {
  row: TickerRow
  history: PriceTick[]
  alerts: AlertRow[]
  watching: boolean
  onToggleWatch: (itemId: string) => void
  onCreateAlert: (itemId: string, direction: AlertDirection, targetPrice: number) => void
  onDeleteAlert: (alertId: string) => void
  onClose: () => void
}

export function ItemDetail({
  row,
  history,
  alerts,
  watching,
  onToggleWatch,
  onCreateAlert,
  onDeleteAlert,
  onClose,
}: ItemDetailProps) {
  const [direction, setDirection] = useState<AlertDirection>('below')
  const [targetPrice, setTargetPrice] = useState(row.current_price.toFixed(2))
  const positive = row.change_24h_amount >= 0

  const chartData = history.map((t) => ({
    time: new Date(t.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }),
    price: t.price,
  }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(targetPrice)
    if (!Number.isFinite(value) || value <= 0) return
    onCreateAlert(row.id, direction, value)
  }

  const itemAlerts = alerts.filter((a) => a.item_id === row.id)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-slate-500 text-sm">
              {row.category_icon} {row.category_name} · {row.provider}
            </div>
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              {row.name}
              {row.price_source === 'amadeus' && (
                <span className="text-[10px] uppercase tracking-wide bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">
                  Live
                </span>
              )}
            </h2>
            <div className="text-slate-500 text-sm">{row.subtitle}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl font-mono font-semibold">{formatCurrency(row.current_price, row.currency)}</span>
          <span className={`font-mono ${positive ? 'text-up' : 'text-down'}`}>
            {positive ? '▲' : '▼'} {formatCurrency(Math.abs(row.change_24h_amount), row.currency)} (
            {Math.abs(row.change_24h_pct).toFixed(2)}%) 24h
          </span>
        </div>

        <button
          onClick={() => onToggleWatch(row.id)}
          className={`mb-6 px-3 py-1.5 rounded-md text-sm font-medium ${
            watching ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          {watching ? '★ In Watchlist' : '☆ Add to Watchlist'}
        </button>

        <div className="h-56 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? '#16a34a' : '#dc2626'} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={positive ? '#16a34a' : '#dc2626'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={40} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) => formatCurrency(v, row.currency)}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, row.currency)}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={positive ? '#16a34a' : '#dc2626'}
                fill="url(#priceGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <h3 className="text-slate-200 font-medium mb-2">Set a price alert</h3>
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as AlertDirection)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-sm"
          >
            <option value="below">Drops below</option>
            <option value="above">Rises above</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-sm flex-1 font-mono"
          />
          <button type="submit" className="bg-sky-500 text-slate-950 rounded-md px-3 py-1.5 text-sm font-medium">
            Set Alert
          </button>
        </form>

        {itemAlerts.length > 0 && (
          <div>
            <h3 className="text-slate-200 font-medium mb-2">Alerts for this item</h3>
            <ul className="space-y-2">
              {itemAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex justify-between items-center bg-slate-900 rounded-md px-3 py-2 text-sm"
                >
                  <span>
                    {alert.triggered_at ? '🔔 Triggered:' : '⏳ Watching:'} {alert.direction === 'above' ? 'rises above' : 'drops below'}{' '}
                    {formatCurrency(alert.target_price, row.currency)}
                  </span>
                  <button
                    onClick={() => onDeleteAlert(alert.id)}
                    className="text-slate-500 hover:text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
