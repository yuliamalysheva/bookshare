import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MapPin, Sparkles } from 'lucide-react'
import { Chip, Empty, StatCard } from '../components/ui'
import { Stars } from '../components/Stars'
import { BookCover } from '../components/BookCover'
import { BookViewModal } from '../components/BookModals'
import { useStore } from '../store'
import { fmtDate, initials, userStats, visibleBooks } from '../lib/utils'
import { AVAILABILITY_LABEL } from '../types'

const LEVEL = {
  trusted: { label: 'Надійний читач', tone: 'success', text: 'Має кілька успішно завершених обмінів і позик.' },
  some: { label: 'Є успішний досвід', tone: 'primary', text: 'Вже завершив(-ла) принаймні один обмін чи позику.' },
  new: { label: 'Новий учасник', tone: 'neutral', text: 'Ще немає завершених обмінів чи позик — діліться книгами обережно.' },
} as const
const tone = { mine: 'success', reserved: 'warn', lent: 'neutral' } as const

export function UserProfile() {
  const { id } = useParams()
  const me = useStore((s) => s.currentUserId)
  const isAdmin = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.role === 'admin')
  const user = useStore((s) => s.users.find((u) => u.id === id))
  const users = useStore((s) => s.users)
  const books = useStore((s) => s.books)
  const requests = useStore((s) => s.requests)
  const reviews = useStore((s) => s.reviews)
  const [openId, setOpenId] = useState<string | null>(null)

  const received = useMemo(
    () => reviews.filter((v) => v.toUserId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, id],
  )
  const avg = received.length ? received.reduce((n, v) => n + v.rating, 0) / received.length : 0
  const stats = useMemo(() => (user ? userStats(user.id, requests) : null), [user, requests])
  const shelf = useMemo(() => visibleBooks(books, users).filter((b) => b.ownerId === id), [books, users, id])

  if (id === me) return <Navigate to="/profile" replace />
  if (!user || !stats || (user.blocked && !isAdmin))
    return <Empty title="Користувача не знайдено" text="Можливо, акаунт було видалено або заблоковано." />

  const lvl = LEVEL[stats.level]

  return (
    <>
      <button onClick={() => history.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Назад
      </button>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-sage text-2xl font-bold text-ink">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {user.city && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {user.city}</span>}
              {user.createdAt && <span>На платформі з {fmtDate(user.createdAt)}</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone={lvl.tone} className="px-3 py-1 text-xs"><BadgeCheck size={13} className="mr-1" />{lvl.label}</Chip>
              {received.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Stars value={avg} /> {avg.toFixed(1)} <span className="font-normal text-muted">· відгуків: {received.length}</span></span>
              )}
              {user.blocked && <Chip tone="danger" className="px-3 py-1 text-xs">Заблокований</Chip>}
            </div>
            <p className="mt-2 text-xs text-muted">{lvl.text}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <StatCard label="Завершених угод" value={stats.completed} desc={`обмінів: ${stats.exchanges} · позик: ${stats.loans}`} />
        <StatCard label="Дав(-ла) книг" value={stats.gave} desc="успішно повернуті або обміняні" />
        <StatCard label="Отримав(-ла) книг" value={stats.received} desc="як читач" />
        <StatCard label="Відповідає на запити" value={stats.answerRate === null ? '—' : `${stats.answerRate}%`} desc={stats.answerRate === null ? 'запитів ще не було' : 'частка отриманих запитів із відповіддю'} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Улюблені жанри</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.genres.length === 0 ? (
            <span className="text-sm text-muted">Жанри не вказано</span>
          ) : (
            user.genres.map((g) => <Chip key={g} tone="primary" className="px-3 py-1 text-xs">{g}</Chip>)
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Відгуки</h2>
        {received.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Відгуків поки немає.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {received.map((v) => {
              const author = users.find((u) => u.id === v.fromUserId)
              return (
                <li key={v.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage text-[11px] font-bold text-ink">{initials(author?.name ?? '')}</span>
                      <span className="text-sm font-semibold">{author?.name ?? 'Користувач'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted"><Stars value={v.rating} /> {fmtDate(v.createdAt)}</div>
                  </div>
                  {v.comment && <p className="mt-2 text-sm text-ink/80">{v.comment}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Бібліотека</h2>
          <span className="text-xs text-muted">{shelf.length} книг</span>
        </div>
        {shelf.length === 0 ? (
          <div className="mt-3"><Empty title="Поки немає книг у каталозі" /></div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {shelf.map((b) => (
              <button key={b.id} onClick={() => setOpenId(b.id)} className="flex flex-col rounded-2xl border border-line bg-surface p-3 text-left shadow-card transition hover:-translate-y-0.5">
                <div className="relative">
                  <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} ratio="148/130" />
                  <Chip tone={tone[b.status]} className="absolute right-2 top-2 bg-surface/95">{AVAILABILITY_LABEL[b.status]}</Chip>
                </div>
                <div className="mt-3 line-clamp-2 min-h-[2.25rem] text-sm font-semibold leading-tight">{b.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted">{b.author}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 flex items-start gap-1.5 text-xs text-muted">
        <Sparkles size={14} className="mt-px shrink-0" /> Показники рахуються за запитами на платформі. Електронна пошта та особисті налаштування не відображаються.
      </p>

      {openId && <BookViewModal bookId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
