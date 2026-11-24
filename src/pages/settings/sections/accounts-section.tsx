import { useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, Terminal, TriangleAlert, XCircle } from 'lucide-react'
import { Button } from '@ui'
import { useClaudeLogin } from '../../../lib/use-claude-login'
import {
  METHOD_LABELS,
  PROVIDERS,
  connectionLabel,
  providerOf,
  type AuthMethod,
  type Connection,
  type ConnectionId,
  type ProviderId,
} from '../settings-model'
import { Group, Hint, useSettingsForm } from './shared'

/**
 * Every connection agents can use: the Claude subscription from the CLI's live sign-in, then the
 * API-key connections saved in settings.
 */
export function useConnections(): Connection[] {
  const { form } = useSettingsForm()
  const { loggedIn, email } = useClaudeLogin()
  const subscription: Connection[] = loggedIn
    ? [{ id: 'anthropic.subscription', provider: 'anthropic', method: 'subscription', account: email }]
    : []
  return [...subscription, ...form.connections]
}

/** TEMPORARY: B-aide doesn't run sessions yet, so none use any connection. */
const activeSessionsOn = (_connection: ConnectionId) => 0

export function AccountsSection() {
  const connections = useConnections()
  return (
    <div className="flex flex-col gap-6">
      <ConnectPane connected={connections.map((c) => c.id)} />
      <Group label="Connections">
        {connections.length ? (
          <ul className="flex flex-col rounded-lg border border-trim divide-y divide-trim">
            {connections.map((connection) => (
              <ConnectionRow key={connection.id} connection={connection} />
            ))}
          </ul>
        ) : (
          <Hint>No connections yet. Agents can't run until one is connected.</Hint>
        )}
        <Hint>Each agent picks its own model below, and the model decides which connection pays for it.</Hint>
      </Group>
    </div>
  )
}

/** Pick a provider and a sign-in method, then sign in or paste a key. */
function ConnectPane({ connected }: { connected: ConnectionId[] }) {
  const [providerId, setProviderId] = useState<ProviderId>('anthropic')
  const provider = providerOf(providerId)
  const [method, setMethod] = useState<AuthMethod>(provider.methods[0]!)
  const chosenMethod = provider.methods.includes(method) ? method : provider.methods[0]!

  return (
    <Group label="Connect">
      <div className="rounded-lg border border-trim p-4 flex flex-col gap-4">
        <div role="radiogroup" aria-label="Provider" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === providerId}
              onClick={() => setProviderId(p.id)}
              className={`flex flex-col items-start px-3 py-2 rounded-md border text-left cursor-pointer ${
                p.id === providerId ? 'border-primary bg-primary/10' : 'border-trim hover:bg-hover-1'
              }`}
            >
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-text-muted">{p.available ? p.runtime : 'Coming soon'}</span>
            </button>
          ))}
        </div>

        {!provider.available ? (
          <Hint>
            {provider.runtime
              ? `${provider.label} runs through the ${provider.runtime}, which B-aide can't drive yet.`
              : `There's no agent runtime for ${provider.label} yet, so B-aide can't run agents with it.`}
          </Hint>
        ) : (
          <>
            {provider.methods.length > 1 && (
              <div role="radiogroup" aria-label="Sign-in method" className="grid grid-cols-2 p-1 gap-1 rounded-lg border border-trim max-w-sm">
                {provider.methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={m === chosenMethod}
                    onClick={() => setMethod(m)}
                    className={`px-3 py-1.5 rounded-md text-sm cursor-pointer ${
                      m === chosenMethod ? 'bg-primary text-background dark:text-text' : 'text-text-muted hover:bg-hover-1'
                    }`}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
            {chosenMethod === 'subscription' ? (
              <SubscriptionConnect />
            ) : (
              <ApiKeyConnect provider={providerId} alreadyConnected={connected.includes(`${providerId}.apiKey`)} />
            )}
          </>
        )}
      </div>
    </Group>
  )
}

function SubscriptionConnect() {
  const { cliFound, loggedIn, connecting, error, connect } = useClaudeLogin()
  return (
    <div className="flex flex-col gap-2">
      <Hint>Signs in to Claude Code with your Claude plan. Finish signing in in the console window that opens.</Hint>
      <Button scheme={loggedIn ? 'default' : 'primary'} onClick={connect} disabled={!cliFound || connecting} className="gap-2 self-start">
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
        {connecting ? 'Waiting for sign-in…' : loggedIn ? 'Reconnect' : 'Connect subscription'}
      </Button>
      {!cliFound && <Hint tone="error">Claude CLI not found.</Hint>}
      {error && <Hint tone="error">{error}</Hint>}
    </div>
  )
}

/**
 * Paste a key and connect. TEMPORARY: the key is only checked for shape and then dropped. Once
 * the API exists it goes to the main process, which test-calls it and encrypts it with
 * `safeStorage`. The front end keeps only its last four characters.
 */
function ApiKeyConnect({ provider, alreadyConnected }: { provider: ProviderId; alreadyConnected: boolean }) {
  const { form, setFormField } = useSettingsForm()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const connect = () => {
    const trimmed = key.trim()
    if (trimmed.length < 20) return setError("That doesn't look like a full API key.")
    const id: ConnectionId = `${provider}.apiKey`
    const connection: Connection = { id, provider, method: 'apiKey', account: `••••${trimmed.slice(-4)}` }
    setFormField('connections', [...form.connections.filter((c) => c.id !== id), connection])
    setKey('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-sm font-medium">API key</span>
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            className="p-2 rounded-md border border-trim bg-background font-mono text-sm"
          />
        </label>
        <Button scheme="primary" onClick={connect} disabled={!key.trim()} className="gap-2">
          <KeyRound className="h-4 w-4" />
          {alreadyConnected ? 'Replace key' : 'Connect'}
        </Button>
      </div>
      {error ? <Hint tone="error">{error}</Hint> : <Hint>Stored encrypted by Windows. B-aide only ever shows its last four characters.</Hint>}
    </div>
  )
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const { form, setFormField } = useSettingsForm()
  const { disconnect } = useClaudeLogin()
  const [confirming, setConfirming] = useState(false)
  const sessions = activeSessionsOn(connection.id)

  const remove = async () => {
    if (connection.method === 'subscription') await disconnect()
    else setFormField('connections', form.connections.filter((c) => c.id !== connection.id))
    setConfirming(false)
  }

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex flex-row items-center gap-3">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium">{connectionLabel(connection.id)}</span>
          <span className="text-xs text-text-muted truncate">
            {connection.account} · {providerOf(connection.provider).runtime}
          </span>
        </div>
        {!confirming && (
          <Button onClick={() => setConfirming(true)} className="gap-2">
            <XCircle className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
      {confirming && (
        <div className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
          <p className="flex flex-row items-start gap-2 text-sm">
            <TriangleAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            {sessions > 0 ? (
              <span>
                <strong>
                  {sessions} active {sessions === 1 ? 'session uses' : 'sessions use'} this connection.
                </strong>{' '}
                They'll stop and can't be resumed until you reconnect it.
              </span>
            ) : (
              <span>No sessions are using this connection. Agents set to its models won't be able to run until it's reconnected.</span>
            )}
          </p>
          <div className="flex flex-row gap-2 justify-end">
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button scheme="anti" onClick={remove}>
              Remove connection
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
