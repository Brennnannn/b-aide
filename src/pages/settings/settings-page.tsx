import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FormWrapper, Frame, navAction, useFormFull, useHeaderBumpCtx } from '@ui'
import { InnerNav } from '../../components/nav/inner-nav'
import { useSettings } from '../../lib/settings-context'
import { useStatus } from '../../lib/status-context'
import { emptyProject, type Settings } from './settings-model'
import { SETTINGS_SECTIONS, scrollToSection, sectionElementId } from './settings-sections'

/** The Settings sidebar (`/settings`): one entry per section, each scrolling the page to it. */
export function SettingsNav() {
  const navItems = SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => navAction({ label, icon: <Icon />, onClick: () => scrollToSection(id) }))
  return <InnerNav name="Settings" navItems={navItems} />
}

/**
 * Every setting on one long page, a section per entry in `SETTINGS_SECTIONS`. Edits save as
 * you make them; there's no Save button.
 */
export function SettingsPage() {
  const headerBump = useHeaderBumpCtx(true)
  const { settings, revision } = useSettings()
  const { status } = useStatus()
  const { hash } = useLocation()

  // Seeded once per revision (an import bumps it). Projects B-aide already knows join the list.
  const [seed, setSeed] = useState<{ revision: number; form: Settings } | null>(null)
  if (status && seed?.revision !== revision) {
    const known = new Set(settings.projects.map((p) => p.path))
    const added = status.projects.filter((p) => !known.has(p.dir)).map((p) => ({ ...emptyProject(), path: p.dir, name: p.name }))
    setSeed({ revision, form: { ...settings, projects: [...settings.projects, ...added] } })
  }

  // Land on the section the URL names (`/settings#agents`)
  useEffect(() => {
    if (seed && hash) scrollToSection(hash.slice(1), 'instant')
  }, [seed !== null])

  if (!seed) return null

  return (
    <Frame format="cornered-end" className={headerBump}>
      <div className="h-full overflow-y-auto">
        <FormWrapper<Settings> initial={seed.form} className="max-w-3xl flex flex-col gap-10 pb-[50vh]" onSubmit={() => {}}>
          <AutoSave />
          <h1 className="text-2xl font-semibold">Settings</h1>
          {SETTINGS_SECTIONS.map(({ id, label, description, Component }) => (
            <section key={id} id={sectionElementId(id)} className="scroll-mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b border-trim pb-2">
                <h2 className="text-lg font-semibold">{label}</h2>
                {description && <p className="text-sm text-text-muted">{description}</p>}
              </div>
              <Component />
            </section>
          ))}
        </FormWrapper>
      </div>
    </Frame>
  )
}

/** Saves the form whenever it changes. */
function AutoSave() {
  const { form } = useFormFull<Settings>()
  const { saveSettings } = useSettings()
  useEffect(() => saveSettings(form), [form])
  return null
}
