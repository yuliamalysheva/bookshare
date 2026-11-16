import { useEffect } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'
import { useToast } from '../store'

/* ---------- Button ---------- */
type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:opacity-90',
  outline: 'border border-line bg-surface text-ink hover:bg-beige/60',
  ghost: 'text-primary hover:bg-beige/60',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
}

export function Button({
  variant = 'primary',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    />
  )
}

/* ---------- Form fields ---------- */
const inputBase =
  'w-full rounded-xl border bg-surface px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

function FieldShell({
  label,
  required,
  optional,
  error,
  hint,
  children,
}: {
  label?: string
  required?: boolean
  optional?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-ink">
          {label}
          {required && <span className="text-danger">*</span>}
          {optional && <span className="font-normal text-muted">необов'язкове</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  )
}

type FieldExtra = { label?: string; required?: boolean; optional?: boolean; error?: string; hint?: string }

export function TextField({ label, required, optional, error, hint, className, ...p }: InputHTMLAttributes<HTMLInputElement> & FieldExtra) {
  return (
    <FieldShell {...{ label, required, optional, error, hint }}>
      <input {...p} className={cn(inputBase, 'h-11', error ? 'border-danger' : 'border-line', className)} />
    </FieldShell>
  )
}

export function TextArea({ label, required, optional, error, hint, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtra) {
  return (
    <FieldShell {...{ label, required, optional, error, hint }}>
      <textarea {...p} className={cn(inputBase, 'min-h-[88px] resize-none py-3', error ? 'border-danger' : 'border-line', className)} />
    </FieldShell>
  )
}

export function SelectField({
  label,
  required,
  error,
  hint,
  className,
  children,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & FieldExtra) {
  return (
    <FieldShell {...{ label, required, error, hint }}>
      <select {...p} className={cn(inputBase, 'h-11', error ? 'border-danger' : 'border-line', className)}>
        {children}
      </select>
    </FieldShell>
  )
}

/** Компактний select для панелей фільтрів. */
export function FilterSelect({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn(
        'h-10 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-primary',
        className,
      )}
    />
  )
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex max-h-[94vh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-[720px]' : 'sm:max-w-[520px]',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-beige/60 text-ink hover:bg-beige"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden px-6 py-5 sm:px-8">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4 sm:px-8">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Misc ---------- */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px] sm:leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, desc }: { label: string; value: ReactNode; desc?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className="absolute left-4 top-4 h-[70px] w-1 rounded-full bg-sage" />
      <div className="pl-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 text-[28px] font-bold leading-tight text-primary">{value}</div>
        {desc && <div className="mt-1 text-[11px] text-muted">{desc}</div>}
      </div>
    </div>
  )
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'primary' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-beige/70 text-ink',
    success: 'bg-success/15 text-success',
    warn: 'bg-warn/20 text-[#9a6410] dark:text-warn',
    primary: 'bg-primary/15 text-primary',
    danger: 'bg-danger/15 text-danger',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-[22px] w-10 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-line')}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all',
          checked ? 'left-[20px]' : 'left-[2px]',
        )}
      />
    </button>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="text-base font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Toast() {
  const message = useToast((s) => s.message)
  if (!message) return null
  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-bg shadow-xl lg:bottom-8">
      {message}
    </div>
  )
}
