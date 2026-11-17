import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, CalendarDays, Info, Pencil, Repeat } from 'lucide-react'
import { Button, Chip, Modal, TextArea, TextField } from './ui'
import { BookCover } from './BookCover'
import { AddBookModal } from './AddBookModal'
import { useStore, useToast } from '../store'
import { AVAILABILITY_LABEL, STATUS_LABEL } from '../types'
import type { Book, RequestType } from '../types'
import { cn, initials, todayLocal } from '../lib/utils'

const statusTone = { mine: 'success', reserved: 'warn', lent: 'neutral' } as const

export function BookViewModal({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const book = useStore((s) => s.books.find((b) => b.id === bookId))
  const owner = useStore((s) => s.users.find((u) => u.id === book?.ownerId))
  const me = useStore((s) => s.currentUserId)
  const isAdmin = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.role === 'admin')
  const removeBook = useStore((s) => s.removeBook)
  const alreadyAsked = useStore((s) => s.requests.some((r) => r.fromUserId === s.currentUserId && r.bookId === bookId && r.status === 'pending'))
  const toast = useToast((s) => s.show)
  const [requesting, setRequesting] = useState(false)
  const [editing, setEditing] = useState(false)

  if (!book || !owner) return null
  const own = book.ownerId === me
  if (!own && !isAdmin && (book.hidden || owner.blocked)) return null
  const canRequest = !own && book.status === 'mine' && (book.loan || book.exchange)

  if (editing) return <AddBookModal book={book} onClose={() => setEditing(false)} />
  if (requesting) return <RequestModal book={book} onClose={onClose} onBack={() => setRequesting(false)} />

  const remove = () => {
    if (!window.confirm(`Видалити «${book.title}» з бібліотеки?`)) return
    removeBook(book.id)
    toast('Книгу видалено')
    onClose()
  }

  return (
    <Modal
      wide
      title={own ? 'Моя книга' : 'Перегляд книги'}
      onClose={onClose}
      footer={
        <>
          {own && book.status === 'mine' && (
            <Button variant="danger" className="mr-auto" onClick={remove}>Видалити</Button>
          )}
          {own && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Редагувати
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Закрити</Button>
          {canRequest && (alreadyAsked ? <Button disabled>Запит уже надіслано</Button> : <Button onClick={() => setRequesting(true)}>Подати запит</Button>)}
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="space-y-4">
          <div className="relative">
            <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} ratio="220/332" size="lg" />
            <Chip tone={statusTone[book.status]} className="absolute right-2 top-2 bg-surface/90">
              {own ? STATUS_LABEL[book.status] : AVAILABILITY_LABEL[book.status]}
            </Chip>
          </div>
          {!own && (
            <div className="rounded-2xl border border-line p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Власник</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage font-bold text-ink">
                  {initials(owner.name)}
                </div>
                <div className="min-w-0">
                  <Link to={`/user/${owner.id}`} className="block truncate text-sm font-semibold hover:text-primary hover:underline">{owner.name}</Link>
                  <div className="text-xs text-muted">{owner.city}</div>
                  <Link to={`/user/${owner.id}`} className="text-xs font-medium text-primary hover:underline">Переглянути профіль</Link>
                </div>
              </div>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold">{book.title}</h3>
          <p className="mt-1 text-base text-muted">{book.author}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {book.genres.map((g) => (
              <Chip key={g} tone="primary" className="px-3 py-1 text-xs">{g}</Chip>
            ))}
            {book.hidden && <Chip tone="danger" className="px-3 py-1 text-xs">Приховано з каталогу</Chip>}
          </div>
          <div className="mt-4 text-xs">
            <span className="font-semibold">ISBN</span> <span className="ml-2 text-muted">{book.isbn || '—'}</span>
          </div>
          <div className="mt-4 text-xs font-semibold">Опис</div>
          <p className="mt-1 text-sm leading-relaxed text-muted">{book.description || 'Опис відсутній.'}</p>

          <div className="mt-5 rounded-2xl border border-line p-4">
            <div className="text-sm font-semibold">Умови отримання</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Condition on={book.loan} icon={<CalendarDays size={15} />} label="Позика" desc="Тимчасово, з поверненням" />
              <Condition on={book.exchange} icon={<Repeat size={15} />} label="Обмін" desc="На іншу книгу" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Condition({ on, icon, label, desc }: { on: boolean; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', on ? 'border-primary/40 bg-primary/5' : 'border-line opacity-50')}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[11px] text-muted">{on ? desc : 'Недоступно'}</span>
      </span>
    </div>
  )
}

/* ---------- Запит на позику / обмін ---------- */
export function RequestModal({ book, onClose, onBack }: { book: Book; onClose: () => void; onBack: () => void }) {
  const me = useStore((s) => s.currentUserId)!
  const owner = useStore((s) => s.users.find((u) => u.id === book.ownerId))
  const myBooks = useStore((s) => s.books)
  const sendRequest = useStore((s) => s.sendRequest)
  const toast = useToast((s) => s.show)

  const available = myBooks.filter((b) => b.ownerId === me && b.status === 'mine' && b.exchange)
  const [type, setType] = useState<RequestType>(book.loan ? 'loan' : 'exchange')
  const [returnDate, setReturnDate] = useState('')
  const [offered, setOffered] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const today = todayLocal()

  const submit = () => {
    setError('')
    if (type === 'loan' && !returnDate) return setError('Вкажіть бажану дату повернення')
    if (type === 'loan' && returnDate < today) return setError('Дата повернення не може бути в минулому')
    if (type === 'exchange' && !offered) return setError('Оберіть книгу, яку пропонуєте в обмін')
    const err = sendRequest({
      type,
      bookId: book.id,
      offeredBookId: type === 'exchange' ? offered : undefined,
      returnDate: type === 'loan' ? returnDate : undefined,
      message,
    })
    if (err) return setError(err)
    toast('Запит надіслано власнику')
    onClose()
  }

  const typeBtn = (t: RequestType, enabled: boolean, label: string, desc: string, icon: React.ReactNode) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => setType(t)}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
        type === t ? 'border-primary bg-primary/5' : 'border-line hover:bg-beige/40',
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/40 text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  )

  return (
    <Modal
      wide
      title="Надіслати запит"
      subtitle="Власник отримає сповіщення та зможе підтвердити або відхилити запит"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onBack}>Назад</Button>
          <Button onClick={submit}>Надіслати запит</Button>
        </>
      }
    >
      <div className="flex items-center gap-4 rounded-2xl border border-line p-4">
        <div className="w-14 shrink-0">
          <BookCover title={book.title} coverUrl={book.coverUrl} ratio="56/72" size="xs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Книга, яку хочете отримати</div>
          <div className="truncate text-base font-semibold">{book.title}</div>
          <div className="truncate text-sm text-muted">{book.author}</div>
          <div className="mt-0.5 text-xs text-muted">Власник: {owner?.name}</div>
        </div>
      </div>

      <div className="mt-5 text-sm font-semibold">Який формат вас цікавить?</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {typeBtn('loan', book.loan, 'Позика', 'Тимчасове користування', <CalendarDays size={18} />)}
        {typeBtn('exchange', book.exchange, 'Обмін', 'Запропонуйте свою книгу', <ArrowLeftRight size={18} />)}
      </div>

      {type === 'loan' && (
        <div className="mt-5">
          <TextField
            label="Бажана дата повернення"
            required
            type="date"
            min={today}
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <Info size={14} className="mt-px shrink-0" /> Власник може запропонувати іншу дату.
          </p>
        </div>
      )}

      {type === 'exchange' && (
        <div className="mt-5">
          <div className="mb-1.5 text-xs font-semibold">
            Що ви пропонуєте в обмін? <span className="text-danger">*</span>
          </div>
          {available.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              У вашій бібліотеці немає вільних книг, доступних для обміну. Додайте книгу з умовою «Обмін».
            </p>
          ) : (
            <div className="grid max-h-52 gap-2 overflow-y-auto">
              {available.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setOffered(b.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2.5 text-left',
                    offered === b.id ? 'border-primary bg-primary/5' : 'border-line hover:bg-beige/40',
                  )}
                >
                  <div className="w-10 shrink-0">
                    <BookCover title={b.title} coverUrl={b.coverUrl} ratio="40/58" size="xs" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.title}</span>
                    <span className="block truncate text-xs text-muted">{b.author}</span>
                  </span>
                  <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full border-2', offered === b.id ? 'border-primary' : 'border-line')}>
                    {offered === b.id && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <TextArea
          label="Повідомлення власнику"
          optional
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Напишіть кілька слів…"
          hint={`${message.length}/300`}
        />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
