import type { ReactNode } from 'react'

type LabTabBarProps = {
  current: string
  onChange: (value: string) => void
  tabs: Array<{ value: string; label: string; shortLabel?: string }>
}

type LabPanelProps = {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}

type LabAccordionSectionProps = {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function LabTabBar({ current, onChange, tabs }: LabTabBarProps) {
  return (
    <div className="lab-tabs" role="tablist" aria-label="Secciones de Chinchón Lab">
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={current === tab.value}
          aria-pressed={current === tab.value}
          className={`lab-tab${current === tab.value ? ' is-active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          <span className="lab-tab__desktop">{tab.label}</span>
          <span className="lab-tab__mobile">{tab.shortLabel ?? tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export function LabPanel({ title, subtitle, children, className = '' }: LabPanelProps) {
  return (
    <section className={`lab-panel ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="lab-panel__header">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function LabAccordionSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: LabAccordionSectionProps) {
  return (
    <details className="lab-accordion" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {subtitle && <small>{subtitle}</small>}
      </summary>
      <div className="lab-accordion__body">{children}</div>
    </details>
  )
}

export function StickyActionBar({ children }: { children: ReactNode }) {
  return <div className="lab-action-bar">{children}</div>
}
