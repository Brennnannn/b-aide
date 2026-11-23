import { Fragment } from 'react'

export type ActionItem = {
  label: string
  /** Any CSS colour (`#16a34a`, `var(--color-error)`). Applied as a style, so it can't be purged. */
  color?: string
  onClick: () => void
}

/**
 * A row of plain-text actions separated by slashes, sized like body text rather than buttons:
 * `Finalize / Stop`. Each word is a real button for keyboard and screen readers.
 *
 * @param {ActionItem[]} actions - The actions, in order
 * @param {string} [className] - Additional classes on the row
 *
 * @example
 * ```tsx
 * <Actions actions={[{ label: 'Override', color: '#ea580c', onClick: override }, { label: 'Change rule', onClick: change }]} />
 * ```
 */
export function Actions({ actions, className = '' }: { actions: ActionItem[]; className?: string }) {
  if (actions.length === 0) return null
  return (
    <div className={`flex flex-row flex-wrap items-center gap-x-2 text-sm ${className}`}>
      {actions.map((action, idx) => (
        <Fragment key={action.label}>
          {idx > 0 && (
            <span className="text-text-muted" aria-hidden>
              /
            </span>
          )}
          <button
            type="button"
            onClick={action.onClick}
            style={action.color ? { color: action.color } : undefined}
            className="font-medium text-text hover:underline underline-offset-4 cursor-pointer"
          >
            {action.label}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
