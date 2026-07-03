import type { PriceTick, TickerRow } from '../types'
import { formatCurrency } from '../lib/session'
import { Sparkline } from './Sparkline'

interface TickerTableProps {
  rows: TickerRow[]
  history: Map<string, PriceTick[]>
  watchlist: Set<string>
  onToggleWatch: (itemId: string) => void
  onSelect: (row: TickerRow) => void
}

export function TickerTable({ rows, history, watchlist, onToggleWatch, onSelect }: TickerTableProps) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-slate-500">No items match your filters.</div>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-800">
          <th className="py-2 pr-2 w-8"></th>
          <th className="py-2 pr-4">Item</th>
          <th className="py-2 pr-4 hidden sm:table-cell">Category</th>
          <th className="py-2 pr-4 text-right">Price</th>
          <th className="py-2 pr-4 text-right">24h Change</th>
          <th className="py-2 pr-4 hidden md:table-cell">Trend (48h)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const positive = row.change_24h_amount >= 0
          const sparkValues = (history.get(row.id) ?? []).map((t) => t.price)
          return (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className="border-b border-slate-900 hover:bg-slate-900/60 cursor-pointer"
            >
              <td className="py-3 pr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleWatch(row.id)
                  }}
                  className={`text-lg ${watchlist.has(row.id) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}
                  aria-label="Toggle watchlist"
                >
                  {watchlist.has(row.id) ? '★' : '☆'}
                </button>
              </td>
              <td className="py-3 pr-4">
                <div className="font-medium text-slate-100 flex items-center gap-2">
                  {row.name}
                  {row.price_source === 'amadeus' && (
                    <span className="text-[10px] uppercase tracking-wide bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">
                      Live
                    </span>
                  )}
                </div>
                <div className="text-slate-500 text-xs">
                  {row.provider} · {row.subtitle}
                </div>
              </td>
              <td className="py-3 pr-4 hidden sm:table-cell text-slate-400">
                {row.category_icon} {row.category_name}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-slate-100">
                {formatCurrency(row.current_price, row.currency)}
              </td>
              <td className={`py-3 pr-4 text-right font-mono ${positive ? 'text-up' : 'text-down'}`}>
                {positive ? '▲' : '▼'} {formatCurrency(Math.abs(row.change_24h_amount), row.currency)}{' '}
                ({Math.abs(row.change_24h_pct).toFixed(2)}%)
              </td>
              <td className="py-3 pr-4 hidden md:table-cell">
                <Sparkline values={sparkValues} positive={positive} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
