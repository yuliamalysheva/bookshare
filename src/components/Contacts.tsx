import { AtSign, Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { User } from '../types'

export const hasContacts = (u?: User) => !!u && !!(u.contacts?.telegram || u.contacts?.phone || u.contacts?.shareEmail)

/** Контакти співрозмовника: показуємо лише після підтвердження запиту. */
export function ContactBlock({ user, meHasContacts }: { user?: User; meHasContacts: boolean }) {
  if (!user) return null
  const c = user.contacts
  const row = 'flex min-w-0 items-center gap-2 text-xs font-semibold hover:text-primary hover:underline'
  return (
    <div className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-success">Контакти для зв'язку</div>
      {hasContacts(user) ? (
        <div className="mt-1.5 grid gap-1">
          {c?.telegram && (
            <a className={row} href={`https://t.me/${c.telegram}`} target="_blank" rel="noreferrer">
              <AtSign size={14} className="shrink-0" /> <span className="truncate">@{c.telegram}</span>
            </a>
          )}
          {c?.phone && (
            <a className={row} href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>
              <Phone size={14} className="shrink-0" /> <span className="truncate">{c.phone}</span>
            </a>
          )}
          {c?.shareEmail && (
            <a className={row} href={`mailto:${user.email}`}>
              <Mail size={14} className="shrink-0" /> <span className="truncate">{user.email}</span>
            </a>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">{user.name.split(' ')[0]} ще не додав(-ла) контакти. Спробуйте написати через запит.</p>
      )}
      {!meHasContacts && (
        <p className="mt-2 text-[11px] text-muted">
          Ваших контактів теж немає — <Link to="/profile" className="font-semibold text-primary hover:underline">додайте їх у профілі</Link>, щоб з вами могли зв'язатися.
        </p>
      )}
    </div>
  )
}
