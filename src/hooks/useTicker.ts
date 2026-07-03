import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { PriceTick, TickerRow } from '../types'

export interface TickerState {
  rows: TickerRow[]
  history: Map<string, PriceTick[]>
  loading: boolean
  error: string | null
  lastRefreshed: Date | null
}

const HISTORY_WINDOW_HOURS = 48

export function useTicker(): TickerState {
  const [rows, setRows] = useState<TickerRow[]>([])
  const [history, setHistory] = useState<Map<string, PriceTick[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchAll() {
    const [tickerRes, historyRes] = await Promise.all([
      supabase.from('v_ticker').select('*').order('name'),
      supabase
        .from('price_ticks')
        .select('item_id, price, ts')
        .gte('ts', new Date(Date.now() - HISTORY_WINDOW_HOURS * 60 * 60 * 1000).toISOString())
        .order('ts', { ascending: true }),
    ])

    if (tickerRes.error) {
      setError(tickerRes.error.message)
      setLoading(false)
      return
    }
    if (historyRes.error) {
      setError(historyRes.error.message)
      setLoading(false)
      return
    }

    const grouped = new Map<string, PriceTick[]>()
    for (const tick of historyRes.data ?? []) {
      const list = grouped.get(tick.item_id) ?? []
      list.push(tick)
      grouped.set(tick.item_id, list)
    }

    setRows((tickerRes.data ?? []) as TickerRow[])
    setHistory(grouped)
    setLoading(false)
    setError(null)
    setLastRefreshed(new Date())
  }

  function scheduleRefresh(delayMs: number) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      fetchAll()
    }, delayMs)
  }

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('price-ticks-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_ticks' },
        () => scheduleRefresh(800),
      )
      .subscribe()

    const pollInterval = setInterval(() => fetchAll(), 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { rows, history, loading, error, lastRefreshed }
}
