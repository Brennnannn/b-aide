import { useEffect } from 'react'
import { Loader2, Terminal } from 'lucide-react'
import { Button, FormField, useFormFull } from '@ui'
import { useClaudeLogin } from '../../lib/use-claude-login'
import type { SetupForm } from './setup-form'

/**
 * Read-only field showing the connected Claude account, with "Connect Claude" beside it.
 * Connecting opens `claude auth login` in its own console window, then polls until it lands.
 */
export function ClaudeAccountField() {
  const { cliFound, email, connecting, error, connect } = useClaudeLogin()
  const { setFormField } = useFormFull<SetupForm>()

  useEffect(() => setFormField('account', email), [email])

  const placeholder = !cliFound ? 'Claude CLI not found' : connecting ? 'Finish signing in in the console window…' : 'Not connected'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <FormField<SetupForm> fieldName="account" label="Claude account" readOnly placeholder={placeholder} />
        <Button scheme={email ? 'default' : 'primary'} onClick={connect} disabled={!cliFound || connecting} className="gap-2">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
          {email ? 'Reconnect' : 'Connect Claude'}
        </Button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}
