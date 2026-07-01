import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getSessionId } from '../lib/session'
import type { AlertDirection, AlertRow } from '../types'

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const sessionId = getSessionId()

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    if (!error) setAlerts((data ?? []) as AlertRow[])
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `session_id=eq.${sessionId}` },
        () => refresh(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, sessionId])

  async function createAlert(itemId: string, direction: AlertDirection, targetPrice: number) {
    await supabase
      .from('alerts')
      .insert({ session_id: sessionId, item_id: itemId, direction, target_price: targetPrice })
    await refresh()
  }

  async function deleteAlert(alertId: string) {
    await supabase.from('alerts').delete().eq('id', alertId)
    await refresh()
  }

  return { alerts, loading, createAlert, deleteAlert }
}
