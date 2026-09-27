const SESSION_KEY = 'tpt_session_id'

// 'amadeus' is retired/stale and must never be treated as a live source.
const LIVE_SOURCES = new Set(['kayak', 'scraper'])

export function isLiveSource(source: string): boolean {
  return LIVE_SOURCES.has(source)
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}
