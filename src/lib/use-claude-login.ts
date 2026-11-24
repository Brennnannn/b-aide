import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useStatus } from './status-context'

const POLL_MS = 2000
const POLL_LIMIT_MS = 5 * 60 * 1000

/**
 * Signing in to the Claude CLI with a subscription. `connect` opens `claude auth login` in its
 * own console window, then polls status until the sign-in lands (or five minutes pass).
 */
export function useClaudeLogin() {
  const { status, refresh, setStatus } = useStatus()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const poll = useRef<number | null>(null)

  const stopPolling = () => {
    if (poll.current !== null) window.clearInterval(poll.current)
    poll.current = null
    setConnecting(false)
  }

  useEffect(() => stopPolling, [])

  const connect = async () => {
    setError(null)
    try {
      await api.login()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    setConnecting(true)
    const startedAt = Date.now()
    poll.current = window.setInterval(async () => {
      const next = await refresh()
      if (next?.auth?.loggedIn || Date.now() - startedAt > POLL_LIMIT_MS) stopPolling()
    }, POLL_MS)
  }

  const disconnect = async () => {
    setError(null)
    try {
      setStatus(await api.logout())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loggedIn = status?.auth?.loggedIn ?? false
  return {
    cliFound: Boolean(status?.cli.path),
    loggedIn,
    email: loggedIn ? (status?.auth?.email ?? 'Connected') : '',
    connecting,
    error,
    connect,
    disconnect,
  }
}
