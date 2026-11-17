import { useMemo, useState } from 'react'
import { Bell, CheckCircle2, Inbox, Sparkles, Star, XCircle } from 'lucide-react'
import { Button, Chip, Empty, PageHeader, StatCard } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { BookViewModal } from '../components/BookModals'
import { useStore } from '../store'
import { cn, findMatches, fmtDate, timeAgo, visibleBooks } from '../lib/utils'
import type { Notif } from '../types'

type Filter = 'all' | 'match' | 'request' | 'unread'

export function Matches() {
  const me = useStore((s) => s.currentUserId)!
  const books = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const wishlist = useStore((s) => s.wishlist)
  const requests = useStore((s) => s.requests)
  const reviews = useStore((s) => s.reviews)
  const notifications = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markRead)
  const markAllRead = useStore((s) => s.markAllRead)

  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = useMemo(() => visibleBooks(books, users), [books, users])
  const matches = useMemo(() => findMatches(wishlist, visible, me), [wishlist, visible, me])
  const mine = useMemo(
    () => notifications.filter((n) => n.userId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications, me],
  )
  const unreadMatchBooks = new Set(mine.filter((n) => n.type === 'match' && !n.read).map((n) => n.bookId))
  const unread = mine.filter((n) => !n.read).length

  const shown = mine.filter(
    (n) =>
      filter === 'all' ||
      (filter === 'match' && n.type === 'match') ||
      (filter === 'request' && n.type !== 'match') ||
      (filter === 'unread' && !n.read),
  )

  const openMatch = (bookId: string) => {
    mine.filter((n) => n.type === 'match' && n.bookId === bookId).forEach((n) => markRead(n.id))
    setOpenId(bookId)
  }

  const describe = (n: Notif) => {
    if (n.type === 'match') {
      const b = visible.find((x) => x.id === n.bookId)
      const o = users.find((u) => u.id === b?.ownerId)
      const who = o?.name ?? 'читача'
      const text = !b ? 'Книга більше недоступна' : n.back ? `«${b.title}» зі списку бажаного знову доступна у ${who}` : `«${b.title}» зі списку бажаного є у ${who}`
      return { icon: Sparkles, title: n.back ? 'Книга знову доступна' : 'Збіг!', text, bookId: b?.id }
    }
    const r = requests.find((x) => x.id === n.requestId)
    const b = books.find((x) => x.id === r?.bookId)
    const from = users.find((u) => u.id === r?.fromUserId)
    const to = users.find((u) => u.id === r?.toUserId)
    const kind = r?.type === 'exchange' ? 'обмін' : 'позику'
    if (n.type === 'request_received')
      return { icon: Inbox, title: 'Новий запит', text: `${from?.name ?? 'Читач'} надіслав(-ла) запит на ${kind} «${b?.title ?? '…'}»`, bookId: undefined }
    if (n.type === 'request_accepted') {
      const other = r?.counter ? books.find((x) => x.id === r.offeredBookId) : undefined
      return { icon: CheckCircle2, title: 'Запит підтверджено', text: `${to?.name ?? 'Власник'} підтвердив(-ла) ваш запит на «${b?.title ?? '…'}»${other ? `, але обрав(-ла) в обмін іншу вашу книгу — «${other.title}»` : ''}. Контакти для зв'язку — у картці запиту`, bookId: undefined }
    }
    if (n.type === 'book_removed') {
      const t = n.bookTitle ?? 'Книгу'
      const text = n.wishRemoved
        ? `«${t}» видалено її власником, тому книгу прибрано з вашого списку бажаного`
        : n.byAdmin
          ? `Вашу книгу «${t}» видалено адміністратором`
          : `«${t}» видалено власником — запит на неї більше не можна виконати`
      return { icon: XCircle, title: 'Книгу видалено', text, bookId: undefined }
    }
    if (n.type === 'review_received') {
      const rv = reviews.find((x) => x.id === n.reviewId)
      const who = users.find((u) => u.id === rv?.fromUserId)
      return { icon: Star, title: 'Новий відгук', text: `${who?.name ?? 'Читач'} залишив(-ла) вам відгук${rv ? `: ${rv.rating} з 5` : ''}`, bookId: undefined }
    }
    if (n.type === 'request_closed') {
      const t = n.bookTitle || b?.title || '…'
      const why = n.reason === 'blocked' ? 'акаунт другої сторони заблоковано' : n.reason === 'deleted' ? 'акаунт другої сторони видалено' : 'власник змінив умови книги'
      return { icon: XCircle, title: 'Запит закрито', text: `Запит на «${t}» закрито: ${why}. Книга знову доступна`, bookId: undefined }
    }
    if (n.type === 'request_withdrawn')
      return { icon: XCircle, title: 'Запит скасовано', text: `${from?.name ?? 'Читач'} скасував(-ла) запит на «${b?.title ?? '…'}»`, bookId: undefined }
    if (n.type === 'request_lent')
      return { icon: CheckCircle2, title: 'Книгу передано', text: `${to?.name ?? 'Власник'} позначив(-ла) «${b?.title ?? '…'}» як передану вам${r?.returnDate ? `. Повернути до ${fmtDate(r.returnDate)}` : ''}`, bookId: undefined }
    if (n.type === 'request_completed')
      return { icon: CheckCircle2, title: 'Угоду завершено', text: `${to?.name ?? 'Власник'} завершив(-ла) ${kind} «${b?.title ?? '…'}». Можна залишити відгук у «Мої запити»`, bookId: undefined }
    if (n.type === 'request_unavailable')
      return { icon: XCircle, title: 'Запит відхилено автоматично', text: `Книгу «${b?.title ?? '…'}» вже заброньовано для іншого читача`, bookId: undefined }
    if (n.type === 'request_cancelled')
      return { icon: XCircle, title: 'Запит скасовано адміністратором', text: `Запит на «${b?.title ?? '…'}» скасовано. Книга знову доступна`, bookId: undefined }
    return { icon: XCircle, title: 'Запит відхилено', text: `${to?.name ?? 'Власник'} відхилив(-ла) ваш запит на «${b?.title ?? '…'}»`, bookId: undefined }
  }

  const tab = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className={cn(
        'h-8 rounded-full border px-4 text-xs font-semibold transition',
        filter === f ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface hover:bg-beige/50',
      )}
    >
      {label}
    </button>
  )

  return (
    <>
      <PageHeader title="Збіги та сповіщення" subtitle="Книги зі списку бажаного, які вже є в бібліотеках читачів" />

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
        <StatCard label="Нові збіги" value={unreadMatchBooks.size} desc="ще не переглянуті" />
        <StatCard label="Усього збігів" value={matches.length} desc="книг доступно зараз" />
        <StatCard label="Непрочитані" value={unread} desc="сповіщення" />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Ваші збіги</h2>
      <div className="mt-3">
        {matches.length === 0 ? (
          <Empty title="Збігів поки немає" text="Додайте книги до списку бажаного — і ми повідомимо, щойно хтось додасть їх до бібліотеки." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            {matches.map(({ book }) => {
              const owner = users.find((u) => u.id === book.ownerId)
              const isNew = unreadMatchBooks.has(book.id)
              return (
                <div key={book.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <div className="w-[75px] shrink-0">
                    <BookCover title={book.title} coverUrl={book.coverUrl} ratio="75/110" size="xs" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <Chip tone={isNew ? 'warn' : 'success'}>{isNew ? 'Новий' : 'Збіг!'}</Chip>
                    </div>
                    <div className="mt-1.5 truncate text-lg font-semibold">{book.title}</div>
                    <div className="truncate text-sm text-muted">{book.author}</div>
                    <div className="mt-1 text-xs text-muted">Власник: {owner?.name}</div>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <div className="flex gap-1.5">
                        {book.loan && <Chip tone="primary">Позика</Chip>}
                        {book.exchange && <Chip tone="warn">Обмін</Chip>}
                      </div>
                      <Button className="h-[30px] rounded-lg px-3 text-xs" onClick={() => openMatch(book.id)}>
                        Переглянути
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Сповіщення</h2>
        <button className="text-xs font-semibold text-primary hover:underline disabled:opacity-40" disabled={unread === 0} onClick={markAllRead}>
          Позначити все як прочитане
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tab('all', 'Усі')}
        {tab('match', 'Збіги')}
        {tab('request', 'Запити')}
        {tab('unread', 'Непрочитані')}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted">
            <Bell size={20} /> Сповіщень немає
          </div>
        ) : (
          shown.map((n) => {
            const d = describe(n)
            const Icon = d.icon
            return (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); if (d.bookId) setOpenId(d.bookId) }}
                className={cn('flex w-full items-center gap-4 border-b border-line p-4 text-left last:border-b-0 hover:bg-beige/30', !n.read && 'bg-primary/5')}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/40 text-primary">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{d.title}</span>
                  <span className="block truncate text-sm text-muted">{d.text}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />}
              </button>
            )
          })
        )}
      </div>

      {openId && <BookViewModal bookId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
