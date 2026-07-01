export interface TickerRow {
  id: string
  category_id: string
  category_slug: string
  category_name: string
  category_icon: string
  name: string
  subtitle: string
  provider: string
  currency: string
  base_price: number
  current_price: number
  last_updated: string
  price_source: 'amadeus' | 'simulated'
  price_24h_ago: number
  change_24h_amount: number
  change_24h_pct: number
}

export interface PriceTick {
  item_id: string
  price: number
  ts: string
}

export interface WatchlistRow {
  id: string
  session_id: string
  item_id: string
  created_at: string
}

export type AlertDirection = 'above' | 'below'

export interface AlertRow {
  id: string
  session_id: string
  item_id: string
  direction: AlertDirection
  target_price: number
  active: boolean
  created_at: string
  triggered_at: string | null
}

export interface Category {
  id: string
  slug: string
  name: string
  icon: string
  sort_order: number
}
