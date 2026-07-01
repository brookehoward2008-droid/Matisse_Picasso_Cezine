import { useMemo, useState } from 'react'
import { useTicker } from './hooks/useTicker'
import { useWatchlist } from './hooks/useWatchlist'
import { useAlerts } from './hooks/useAlerts'
import { CategoryTabs } from './components/CategoryTabs'
import { TickerTable } from './components/TickerTable'
import { ItemDetail } from './components/ItemDetail'
import type { Category, TickerRow } from './types'

type SortKey = 'name' | 'price' | 'change'

export default function App() {
  const { rows, history, loading, error, lastRefreshed } = useTicker()
  const { itemIds: watchlist, toggle: toggleWatch } = useWatchlist()
  const { alerts, createAlert, deleteAlert } = useAlerts()

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [selected, setSelected] = useState<TickerRow | null>(null)

  const categories = useMemo<Category[]>(() => {
    const map = new Map<string, Category>()
    for (const row of rows) {
      if (!map.has(row.category_slug)) {
        map.set(row.category_slug, {
          id: row.category_id,
          slug: row.category_slug,
          name: row.category_name,
          icon: row.category_icon,
          sort_order: 0,
        })
      }
    }
    return Array.from(map.values())
  }, [rows])

  const filteredRows = useMemo(() => {
    let list = rows
    if (activeTab === 'watchlist') {
      list = list.filter((r) => watchlist.has(r.id))
    } else if (activeTab !== 'all') {
      list = list.filter((r) => r.category_slug === activeTab)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sortKey === 'price') sorted.sort((a, b) => b.current_price - a.current_price)
    if (sortKey === 'change') sorted.sort((a, b) => b.change_24h_pct - a.change_24h_pct)
    return sorted
  }, [rows, activeTab, search, sortKey, watchlist])

  const selectedHistory = selected ? history.get(selected.id) ?? [] : []
  const selectedRow = selected ? rows.find((r) => r.id === selected.id) ?? selected : null

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-6">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            TravelTicker
          </h1>
          <p className="text-slate-500 text-sm">
            Live-simulated prices for cruises, flights, vacation packages, all-inclusive resorts, and hotels.
          </p>
        </div>
        <div className="text-xs text-slate-600 text-right">
          {lastRefreshed && <div>Updated {lastRefreshed.toLocaleTimeString()}</div>}
          {alerts.some((a) => a.triggered_at) && (
            <div className="text-amber-400 mt-1">
              🔔 {alerts.filter((a) => a.triggered_at).length} alert(s) triggered
            </div>
          )}
        </div>
      </header>

      <CategoryTabs categories={categories} active={activeTab} onChange={setActiveTab} watchlistCount={watchlist.size} />

      <div className="flex flex-wrap gap-3 items-center my-4">
        <input
          type="text"
          placeholder="Search by name, provider, or destination..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"
        >
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price (high to low)</option>
          <option value="change">Sort: 24h Change</option>
        </select>
      </div>

      {loading && <div className="py-12 text-center text-slate-500">Loading live prices...</div>}
      {error && <div className="py-12 text-center text-red-400">Error loading prices: {error}</div>}
      {!loading && !error && (
        <TickerTable
          rows={filteredRows}
          history={history}
          watchlist={watchlist}
          onToggleWatch={toggleWatch}
          onSelect={setSelected}
        />
      )}

      {selectedRow && (
        <ItemDetail
          row={selectedRow}
          history={selectedHistory}
          alerts={alerts}
          watching={watchlist.has(selectedRow.id)}
          onToggleWatch={toggleWatch}
          onCreateAlert={createAlert}
          onDeleteAlert={deleteAlert}
          onClose={() => setSelected(null)}
        />
      )}

      <footer className="text-center text-slate-700 text-xs mt-10 pb-4">
        Prices are simulated for demo purposes and update every minute.
      </footer>
    </div>
  )
}
