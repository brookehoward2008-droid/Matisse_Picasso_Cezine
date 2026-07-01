import type { Category } from '../types'

interface CategoryTabsProps {
  categories: Category[]
  active: string
  onChange: (slug: string) => void
  watchlistCount: number
}

export function CategoryTabs({ categories, active, onChange, watchlistCount }: CategoryTabsProps) {
  const tabs = [{ id: 'all', label: 'All', icon: '📊' }, ...categories.map((c) => ({ id: c.slug, label: c.name, icon: c.icon }))]

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === tab.id
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span className="mr-1">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
      <button
        onClick={() => onChange('watchlist')}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          active === 'watchlist'
            ? 'bg-amber-400 text-slate-950'
            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
        }`}
      >
        ⭐ Watchlist{watchlistCount > 0 ? ` (${watchlistCount})` : ''}
      </button>
    </div>
  )
}
