import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getSessionId } from '../lib/session'

export function useWatchlist() {
  const [itemIds, setItemIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const sessionId = getSessionId()

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('watchlist')
      .select('item_id')
      .eq('session_id', sessionId)
    if (!error) {
      setItemIds(new Set((data ?? []).map((row) => row.item_id)))
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function toggle(itemId: string) {
    if (itemIds.has(itemId)) {
      await supabase.from('watchlist').delete().eq('session_id', sessionId).eq('item_id', itemId)
    } else {
      await supabase.from('watchlist').insert({ session_id: sessionId, item_id: itemId })
    }
    await refresh()
  }

  return { itemIds, loading, toggle }
}
