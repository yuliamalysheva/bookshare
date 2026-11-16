import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, CalendarDays } from 'lucide-react'
import { Button, Chip, Empty, FilterSelect, Modal, PageHeader, StatCard, TextArea } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { ContactBlock, hasContacts } from '../components/Contacts'
import { StarPicker, Stars } from '../components/Stars'
import { useStore, useToast } from '../store'
import { REQUEST_STATUS_LABEL } from '../types'
import type { Book, BookRequest, RequestStatus } from '../types'
import { cn, fmtDate, initials, timeAgo } from '../lib/utils'

type Tab = 'pending' | 'active' | 'done'
const TAB_STATUS: Record<Tab, RequestStatus[]> = {
  pending: ['pending'],
  active: ['accepted'],
  done: ['completed', 'declined', 'cancelled'],
}
const statusTone = { pending: 'warn', accepted: 'success', completed: 'primary', declined: 'danger', cancelled: 'neutral' } as const

/** Одна книга в картці запиту: підпис, обкладинка, назва, автор. Однакові розміри скрізь. */
function BookMini({ label, book }: { label: string; book: Book }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex items-start gap-3">
        <div className="w-[52px] shrink-0">
          <BookCover title={book.title} coverUrl={book.coverUrl} ratio="52/76" size="xs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug" title={book.title}>{book.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted" title={book.author}>{book.author}</div>
        </div>
      </div>
    </div>
  )
}

function ReturnBox({ date }: { date?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">Повернення до</div>
      <div className="flex h-[76px] items-center gap-2.5 rounded-xl border border-line bg-beige/30 px-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage/40 text-primary">
          <CalendarDays size={17} />
        </span>
        <span className="min-w-0 whitespace-nowrap text-[13px] font-semibold">{fmtDate(date).replace(/\s?р\.$/, '')}</span>
      </div>
    </div>
  )
}

/** Власник обирає іншу книгу з бібліотеки того, хто пропонує обмін. */
function PickOfferModal({ request, onClose }: { request: BookRequest; onClose: () => void }) {
  const books = useStore((s) => s.books)
  const from = useStore((s) => s.users.find((u) => u.id === request.fromUserId))
  const respond = useStore((s) => s.respondRequest)
  const toast = useToast((s) => s.show)
  const [picked, setPicked] = useState(request.offeredBookId ?? '')
  const [error, setError] = useState('')

  const list = books.filter((b) => b.ownerId === request.fromUserId && b.status === 'mine' && b.exchange && !b.hidden)

  const submit = () => {
    const err = respond(request.id, true, picked)
    if (err) return setError(err)
    toast('Обмін підтверджено з обраною книгою')
    onClose()
  }

  return (
    <Modal
      wide
      title="Обрати іншу книгу"
      subtitle={`Оберіть книгу з бібліотеки ${from?.name ?? 'читача'}, яку хочете отримати в обмін`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Скасувати</Button>
          <Button disabled={!picked} onClick={submit}>Підтвердити обмін</Button>
        </>
      }
    >
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          У цього читача немає інших вільних книг, доступних для обміну.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {list.map((b) => (
            <li key={b.id} className="min-w-0">
              <button
                type="button"
                onClick={() => { setPicked(b.id); setError('') }}
                className={cn(
                  'flex w-full min-w-0 items-center gap-4 rounded-xl border p-3 text-left transition',
                  picked === b.id ? 'border-primary bg-primary/5' : 'border-line hover:bg-beige/40',
                )}
              >
                <div className="w-12 shrink-0"><BookCover title={b.title} coverUrl={b.coverUrl} ratio="48/68" size="xs" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{b.title}</div>
                  <div className="truncate text-xs text-muted">{b.author}</div>
                  <div className="truncate text-[11px] text-muted">{b.genres.join(', ')}</div>
                </div>
                {b.id === request.offeredBookId && <Chip tone="neutral" className="shrink-0">Запропоновано</Chip>}
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', picked === b.id ? 'border-primary' : 'border-line')}>
                  {picked === b.id && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Modal>
  )
}

/** Необов'язковий відгук про співрозмовника після завершеної угоди. */
function ReviewModal({ request, onClose }: { request: BookRequest; onClose: () => void }) {
  const me = useStore((s) => s.currentUserId)!
  const other = useStore((s) => s.users.find((u) => u.id === (request.fromUserId === me ? request.toUserId : request.fromUserId)))
  const addReview = useStore((s) => s.addReview)
  const toast = useToast((s) => s.show)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const err = addReview(request.id, rating, comment)
    if (err) return setError(err)
    toast('Дякуємо за відгук!')
    onClose()
  }

  return (
    <Modal
      title="Залишити відгук"
      subtitle={`Як минула угода з ${other?.name ?? 'користувачем'}? Це необов'язково`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Не зараз</Button>
          <Button disabled={!rating} onClick={submit}>Надіслати відгук</Button>
        </>
      }
    >
      <div className="text-xs font-semibold">Оцінка</div>
      <div className="mt-1"><StarPicker value={rating} onChange={(v) => { setRating(v); setError('') }} /></div>
      <div className="mt-4">
        <TextArea label="Коментар" optional maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Наприклад: книга в гарному стані, зустрілись вчасно" />
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Modal>
  )
}

export function Requests() {
  const me = useStore((s) => s.currentUserId)!
  const requests = useStore((s) => s.requests)
  const books = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const respond = useStore((s) => s.respondRequest)
  const cancel = useStore((s) => s.cancelRequest)
  const markLent = useStore((s) => s.markLent)
  const complete = useStore((s) => s.completeRequest)
  const toast = useToast((s) => s.show)

  const [tab, setTab] = useState<Tab>('pending')
  const [type, setType] = useState<'' | 'loan' | 'exchange'>('')
  const [sort, setSort] = useState<'new' | 'old'>('new')
  const [pickFor, setPickFor] = useState<BookRequest | null>(null)
  const [reviewFor, setReviewFor] = useState<BookRequest | null>(null)
  const reviews = useStore((s) => s.reviews)

  const mine = useMemo(
    () => requests.filter((r) => (r.fromUserId === me || r.toUserId === me) && books.some((b) => b.id === r.bookId)),
    [requests, me, books],
  )
  const count = (t: Tab) => mine.filter((r) => TAB_STATUS[t].includes(r.status)).length

  const list = useMemo(() => {
    const out = mine.filter((r) => TAB_STATUS[tab].includes(r.status) && (!type || r.type === type))
    return out.sort((a, b) => (sort === 'new' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
  }, [mine, tab, type, sort])

  const received = mine.filter((r) => r.toUserId === me && r.status === 'pending').length
  const sent = mine.filter((r) => r.fromUserId === me && r.status === 'pending').length

  const btn = 'h-9 rounded-lg px-4 text-xs'

  const renderCard = (r: BookRequest) => {
    const book = books.find((b) => b.id === r.bookId)
    const offered = books.find((b) => b.id === r.offeredBookId)
    const incoming = r.toUserId === me
    const other = users.find((u) => u.id === (incoming ? r.fromUserId : r.toUserId))
    if (!book) return null
    const isExchange = r.type === 'exchange' && !!offered

    return (
      <div key={r.id} className="flex h-full flex-col rounded-2xl border border-line bg-surface shadow-card">
        {/* Шапка */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{r.type === 'loan' ? 'Запит на позику' : 'Запит на обмін'}</span>
            <Chip tone={incoming ? 'primary' : 'neutral'} className="shrink-0">{incoming ? 'Отриманий' : 'Надісланий'}</Chip>
          </div>
          <Chip tone={statusTone[r.status]} className="shrink-0">{REQUEST_STATUS_LABEL[r.status]}</Chip>
        </div>

        {/* Книги: однакова сітка для позики й обміну */}
        <div className="grid grid-cols-1 gap-4 px-5 pt-5 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-3">
          <BookMini label={incoming ? 'Ваша книга' : 'Книга, яку хочете'} book={book} />
          <span className="hidden h-9 w-9 items-center justify-center self-end rounded-full bg-sage/40 text-primary sm:mb-[19px] sm:flex">
            {isExchange ? <ArrowLeftRight size={16} /> : <ArrowRight size={16} />}
          </span>
          {isExchange ? (
            <BookMini label={incoming ? 'Пропонують' : 'Ви пропонуєте'} book={offered!} />
          ) : (
            <ReturnBox date={r.returnDate} />
          )}
        </div>

        {/* Людина та повідомлення (зарезервоване місце під 2 рядки) */}
        <div className="mt-4 flex-1 px-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-[11px] font-bold text-ink">
              {initials(other?.name ?? '')}
            </span>
            <span className="text-muted">{incoming ? 'Від' : 'Кому'}:</span>
            {other ? <Link to={`/user/${other.id}`} className="truncate font-bold hover:text-primary hover:underline" title="Переглянути профіль">{other.name}</Link> : <b>—</b>}
          </div>
          {r.status === 'accepted' && <ContactBlock user={other} meHasContacts={hasContacts(users.find((u) => u.id === me))} />}
          <p className={cn('mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-5', r.message ? 'italic text-ink/80' : 'text-muted')}>
            {r.message ? `«${r.message}»` : 'Без повідомлення'}
          </p>
        </div>

        {/* Підвал: завжди внизу, кнопки однакового розміру */}
        <div className="mt-4 flex min-h-[61px] flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          {r.status === 'completed' ? (
            (() => {
              const mineReview = reviews.find((v) => v.requestId === r.id && v.fromUserId === me)
              return mineReview ? (
                <span className="flex items-center gap-2 text-[11px] text-muted">Ваш відгук: <Stars value={mineReview.rating} /></span>
              ) : (
                <span className="text-[11px] text-muted">Відгук необов'язковий</span>
              )
            })()
          ) : (
            <span className="text-[11px] text-muted">{timeAgo(r.createdAt)}</span>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {r.status === 'pending' && incoming && (
              <>
                <Button variant="outline" className={btn} onClick={() => { respond(r.id, false); toast('Запит відхилено') }}>Відхилити</Button>
                {isExchange && <Button variant="outline" className={btn} onClick={() => setPickFor(r)}>Обрати іншу книгу</Button>}
                <Button className={btn} onClick={() => { const e = respond(r.id, true); toast(e ?? 'Запит підтверджено') }}>Підтвердити</Button>
              </>
            )}
            {r.status === 'pending' && !incoming && (
              <Button variant="outline" className={btn} onClick={() => { cancel(r.id); toast('Запит скасовано') }}>Скасувати запит</Button>
            )}
            {r.status === 'completed' && !reviews.some((v) => v.requestId === r.id && v.fromUserId === me) && (
              <Button variant="outline" className={btn} onClick={() => setReviewFor(r)}>Залишити відгук</Button>
            )}
            {r.status === 'accepted' && incoming && (
              <>
                {r.type === 'loan' && book.status === 'reserved' && (
                  <Button variant="outline" className={btn} onClick={() => { markLent(r.id); toast('Книгу позначено як передану') }}>Передано</Button>
                )}
                <Button className={btn} onClick={() => { complete(r.id); toast('Запит завершено') }}>
                  {r.type === 'loan' ? 'Книгу повернено' : 'Завершити обмін'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={cn(
        'flex h-[34px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition',
        tab === t ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface hover:bg-beige/50',
      )}
    >
      {label}
      {count(t) > 0 && (
        <span className={cn('rounded-full px-1.5 text-[11px]', tab === t ? 'bg-primary-fg/25' : 'bg-beige')}>{count(t)}</span>
      )}
    </button>
  )

  return (
    <>
      <PageHeader title="Мої запити" subtitle="Отримані та надіслані запити на позику й обмін книг" />

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
        <StatCard label="Очікують вашої відповіді" value={received} desc="отримані запити" />
        <StatCard label="Надіслані" value={sent} desc="очікують відповіді" />
        <StatCard label="Активні" value={count('active')} desc="підтверджені запити" />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex gap-2">
          {tabBtn('pending', 'Очікують')}
          {tabBtn('active', 'Активні')}
          {tabBtn('done', 'Завершені')}
        </div>
        <div className="flex gap-2">
          <FilterSelect value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Тип">
            <option value="">Усі типи</option>
            <option value="loan">Позика</option>
            <option value="exchange">Обмін</option>
          </FilterSelect>
          <FilterSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортування">
            <option value="new">Спочатку нові</option>
            <option value="old">Спочатку старі</option>
          </FilterSelect>
        </div>
      </div>

      <div className="mt-5">
        {list.length === 0 ? (
          <Empty title="Запитів немає" text="Тут з'являтимуться запити на позику та обмін книг." />
        ) : (
          <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:gap-6">{list.map(renderCard)}</div>
        )}
      </div>

      {reviewFor && <ReviewModal request={reviewFor} onClose={() => setReviewFor(null)} />}
      {pickFor && <PickOfferModal request={pickFor} onClose={() => setPickFor(null)} />}
    </>
  )
}
