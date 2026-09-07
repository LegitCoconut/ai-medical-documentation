import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { Visit } from '@/lib/types'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
      {...rest}
    />
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`.trim()} {...rest} />
}

export function Textarea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input ${className}`.trim()} {...rest} />
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input ${className}`.trim()} {...rest}>
      {children}
    </select>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label-xs block mb-1">
      {children}
    </label>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && (
        <p className="text-[13px] text-[var(--text)] font-medium mt-1.5">{error}</p>
      )}
    </div>
  )
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`card p-4 ${className}`.trim()}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="card-title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return <th>{children}</th>
}

export function Td({ children }: { children: ReactNode }) {
  return <td>{children}</td>
}

const statusLabel: Record<Visit['status'], string> = {
  waiting: 'Waiting',
  in_progress: 'In progress',
  completed: 'Completed',
}

export function StatusPill({ status }: { status: Visit['status'] }) {
  const cls = status === 'in_progress' ? 'pill pill-dark' : status === 'completed' ? 'pill pill-muted' : 'pill'
  return <span className={cls}>{statusLabel[status]}</span>
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[length:var(--text-micro)] uppercase tracking-wide text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
      {children}
    </span>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12 px-4 border-t border-dashed border-[var(--border-strong)]">
      <p className="text-[length:var(--text-body)]">{title}</p>
      {hint && <p className="text-[12px] text-[var(--muted)] mt-1.5">{hint}</p>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[length:var(--text-title)] font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-[length:var(--text-table)] text-[var(--muted)] mt-1">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
