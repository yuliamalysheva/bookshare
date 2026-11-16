import { useMemo, useState } from 'react'
import { Check, EyeOff, Eye, Pencil, Search, ShieldCheck, ShieldOff, Trash2, Ban, Undo2, X } from 'lucide-react'
import { Button, Chip, Empty, FilterSelect, PageHeader, StatCard } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { AddBookModal } from '../components/AddBookModal'
import { useStore, useToast } from '../store'
import { REQUEST_STATUS_LABEL, STATUS_LABEL } from '../types'
import type { RequestStatus } from '../types'
import { cn, findMatches, initials, timeAgo, visibleBooks } from '../lib/utils'

type Tab = 'stats' | 'users' | 'books' | 'requests' | 'genres'
const TABS: [Tab, string][] = [
  ['stats', 'Статистика'],
  ['users', 'Користувачі'],
  ['books', 'Книги'],
  ['requests', 'Запити'],
  ['genres', 'Жанри'],
]
const reqTone = { pending: 'warn', accepted: 'success', completed: 'primary', declined: 'danger', cancelled: 'neutral' } as const
const bookTone = { mine: 'success', reserved: 'warn', lent: 'neutral' } as const

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-bg pl-10 pr-3 text-sm outline-none focus:border-primary"
      />
    </div>
  )
}

const small = 'h-9 rounded-lg px-3 text-xs'

/* ---------- Статистика ---------- */
function Stats() {
  const users = useStore((s) => s.users)
  const books = useStore((s) => s.books)
  const requests = useStore((s) => s.requests)
  const wishlist = useStore((s) => s.wishlist)

  const matches = useMemo(() => {
    const shown = visibleBooks(books, users)
    return users.filter((u) => !u.blocked).reduce((n, u) => n + findMatches(wishlist, shown, u.id).length, 0)
  }, [users, books, wishlist])

  const byStatus = (Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).map((st) => ({
    st,
    n: requests.filter((r) => r.status === st).length,
  }))

  const genres = useMemo(() => {
    const m = new Map<string, number>()
    books.forEach((b) => b.genres.forEach((g) => m.set(g, (m.get(g) ?? 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [books])
  const maxG = Math.max(1, ...genres.map((g) => g[1]))

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <StatCard label="Користувачі" value={users.length} desc={`заблоковано: ${users.filter((u) => u.blocked).length}`} />
        <StatCard label="Книги" value={books.length} desc={`приховано: ${books.filter((b) => b.hidden).length}`} />
        <StatCard label="Запити" value={requests.length} desc="усього" />
        <StatCard label="Збігів знайдено" value={matches} desc="книги зі списків бажаного, що є в каталозі" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold">Запити за статусами</h2>
          <ul className="mt-4 space-y-3">
            {byStatus.map(({ st, n }) => (
              <li key={st} className="flex items-center justify-between gap-3">
                <Chip tone={reqTone[st]}>{REQUEST_STATUS_LABEL[st]}</Chip>
                <span className="text-lg font-bold">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold">Найпопулярніші жанри</h2>
          {genres.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Книг ще немає.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {genres.map(([g, n]) => (
                <li key={g}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold">{g}</span>
                    <span className="text-muted">{n}</span>
                  </div>
                  <div className="h-2 rounded-full bg-beige">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(n / maxG) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

/* ---------- Користувачі ---------- */
function Users() {
  const me = useStore((s) => s.currentUserId)
  const users = useStore((s) => s.users)
  const books = useStore((s) => s.books)
  const requests = useStore((s) => s.requests)
  const setBlocked = useStore((s) => s.adminSetBlocked)
  const del = useStore((s) => s.adminDeleteUser)
  const setRole = useStore((s) => s.adminSetRole)
  const toast = useToast((s) => s.show)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase()
    return users
      .map((u) => ({
        u,
        books: books.filter((b) => b.ownerId === u.id).length,
        reqs: requests.filter((r) => r.fromUserId === u.id || r.toUserId === u.id).length,
      }))
      .filter(
        ({ u, books: b, reqs }) =>
          !n || [u.name, u.email, u.city, String(b), String(reqs)].some((v) => v.toLowerCase().includes(n)),
      )
  }, [users, books, requests, q])

  const run = (err: string | null, ok: string) => toast(err ?? ok)

  return (
    <>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <SearchBox value={q} onChange={setQ} placeholder="Ім'я, пошта, місто, кількість книг чи запитів" />
      </div>
      <div className="mt-2 text-right text-xs text-muted">Знайдено: {rows.length}</div>
      {rows.length === 0 ? (
        <Empty title="Нікого не знайдено" />
      ) : (
        <ul className="mt-2 grid gap-3">
          {rows.map(({ u, books: nb, reqs }) => {
            const self = u.id === me
            return (
              <li key={u.id} className={cn('flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card', u.blocked && 'opacity-75')}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage font-bold text-ink">{initials(u.name)}</span>
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.name}</span>
                    {self && <Chip tone="neutral">Це ви</Chip>}
                    {u.role === 'admin' && <Chip tone="primary">Адмін</Chip>}
                    {u.blocked && <Chip tone="danger">Заблокований</Chip>}
                  </div>
                  <div className="truncate text-xs text-muted">{u.email} · {u.city || '—'}</div>
                </div>
                <div className="flex gap-5 text-center text-xs text-muted">
                  <div><div className="text-lg font-bold text-ink">{nb}</div>книг</div>
                  <div><div className="text-lg font-bold text-ink">{reqs}</div>запитів</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.role === 'admin' ? (
                    <Button variant="outline" className={small} onClick={() => run(setRole(u.id, 'user'), 'Роль адміністратора знято')}>
                      <ShieldOff size={14} /> Зняти адміна
                    </Button>
                  ) : (
                    <Button variant="outline" className={small} onClick={() => run(setRole(u.id, 'admin'), 'Призначено адміністратором')}>
                      <ShieldCheck size={14} /> Зробити адміном
                    </Button>
                  )}
                  {!self && (
                    <>
                      <Button variant="outline" className={small} onClick={() => run(setBlocked(u.id, !u.blocked), u.blocked ? 'Користувача розблоковано' : 'Користувача заблоковано')}>
                        {u.blocked ? <><Undo2 size={14} /> Розблокувати</> : <><Ban size={14} /> Заблокувати</>}
                      </Button>
                      <Button
                        variant="danger"
                        className={small}
                        onClick={() => {
                          if (window.confirm(`Видалити акаунт «${u.name}» разом з його книгами та запитами? Дію неможливо скасувати.`)) run(del(u.id), 'Акаунт видалено')
                        }}
                      >
                        <Trash2 size={14} /> Видалити
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/* ---------- Книги ---------- */
function Books() {
  const books = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const toggleHidden = useStore((s) => s.adminToggleHidden)
  const remove = useStore((s) => s.removeBook)
  const toast = useToast((s) => s.show)
  const [q, setQ] = useState('')
  const [f, setF] = useState<'' | 'hidden' | 'visible'>('')
  const [editId, setEditId] = useState<string | null>(null)

  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return [...books]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((b) => {
        const owner = users.find((u) => u.id === b.ownerId)
        return (
          (!n || [b.title, b.author, b.isbn, owner?.name ?? ''].some((v) => v.toLowerCase().includes(n))) &&
          (!f || (f === 'hidden' ? !!b.hidden : !b.hidden))
        )
      })
  }, [books, users, q, f])

  const editing = books.find((b) => b.id === editId)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <SearchBox value={q} onChange={setQ} placeholder="Назва, автор, ISBN або власник" />
        <FilterSelect value={f} onChange={(e) => setF(e.target.value as typeof f)} aria-label="Видимість">
          <option value="">Усі книги</option>
          <option value="visible">Видимі в каталозі</option>
          <option value="hidden">Приховані</option>
        </FilterSelect>
      </div>
      <div className="mt-2 text-right text-xs text-muted">Знайдено: {list.length}</div>
      {list.length === 0 ? (
        <Empty title="Книг не знайдено" />
      ) : (
        <ul className="mt-2 grid gap-3">
          {list.map((b) => {
            const owner = users.find((u) => u.id === b.ownerId)
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4">
                <div className="w-[52px] shrink-0">
                  <BookCover title={b.title} coverUrl={b.coverUrl} ratio="52/76" size="xs" />
                </div>
                <div className="min-w-[200px] flex-1">
                  <div className="line-clamp-1 text-sm font-semibold">{b.title}</div>
                  <div className="truncate text-xs text-muted">{b.author} · {b.genres.join(', ')}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">Власник: {owner?.name ?? '—'}{b.isbn ? ` · ISBN ${b.isbn}` : ''}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Chip tone={bookTone[b.status]}>{STATUS_LABEL[b.status]}</Chip>
                    {b.hidden && <Chip tone="danger">Приховано</Chip>}
                    {owner?.blocked && <Chip tone="danger">Власник заблокований</Chip>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className={small} onClick={() => { toggleHidden(b.id); toast(b.hidden ? 'Книгу знову показано в каталозі' : 'Книгу приховано з каталогу') }}>
                    {b.hidden ? <><Eye size={14} /> Показати</> : <><EyeOff size={14} /> Приховати</>}
                  </Button>
                  <Button variant="outline" className={small} onClick={() => setEditId(b.id)}>
                    <Pencil size={14} /> Редагувати
                  </Button>
                  <Button
                    variant="danger"
                    className={small}
                    onClick={() => {
                      const warn = b.status !== 'mine' ? ' Книга зараз у запиті — пов’язані запити теж буде видалено.' : ''
                      if (window.confirm(`Видалити «${b.title}»?${warn}`)) { remove(b.id); toast('Книгу видалено') }
                    }}
                  >
                    <Trash2 size={14} /> Видалити
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <AddBookModal book={editing} onClose={() => setEditId(null)} />}
    </>
  )
}

/* ---------- Запити ---------- */
function Requests() {
  const requests = useStore((s) => s.requests)
  const books = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const cancel = useStore((s) => s.adminCancelRequest)
  const toast = useToast((s) => s.show)
  const [st, setSt] = useState<'' | RequestStatus>('')

  const list = useMemo(
    () => [...requests].filter((r) => !st || r.status === st).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [requests, st],
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
        <span className="px-1 text-sm text-muted">Усі запити на позику й обмін</span>
        <FilterSelect value={st} onChange={(e) => setSt(e.target.value as typeof st)} aria-label="Статус">
          <option value="">Усі статуси</option>
          {(Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
        </FilterSelect>
      </div>
      <div className="mt-2 text-right text-xs text-muted">Знайдено: {list.length}</div>
      {list.length === 0 ? (
        <Empty title="Запитів немає" />
      ) : (
        <ul className="mt-2 grid gap-3">
          {list.map((r) => {
            const book = books.find((b) => b.id === r.bookId)
            const offered = books.find((b) => b.id === r.offeredBookId)
            const from = users.find((u) => u.id === r.fromUserId)
            const to = users.find((u) => u.id === r.toUserId)
            const active = r.status === 'pending' || r.status === 'accepted'
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.type === 'loan' ? 'Позика' : 'Обмін'}: «{book?.title ?? '…'}»</span>
                    <Chip tone={reqTone[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Chip>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {from?.name ?? 'Видалений'} → {to?.name ?? 'Видалений'}
                    {offered ? ` · пропонує «${offered.title}»` : ''}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">Оновлено {timeAgo(r.updatedAt)}</div>
                </div>
                {active && (
                  <Button
                    variant="danger"
                    className={small}
                    onClick={() => {
                      if (window.confirm('Примусово скасувати запит? Заброньовані книги знову стануть доступними, обидві сторони отримають сповіщення.')) {
                        cancel(r.id)
                        toast('Запит скасовано')
                      }
                    }}
                  >
                    <X size={14} /> Скасувати примусово
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/* ---------- Жанри ---------- */
function Genres() {
  const genres = useStore((s) => s.genres)
  const books = useStore((s) => s.books)
  const add = useStore((s) => s.addGenre)
  const rename = useStore((s) => s.renameGenre)
  const del = useStore((s) => s.deleteGenre)
  const toast = useToast((s) => s.show)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')

  const submitAdd = () => {
    const err = add(name)
    if (err) return toast(err)
    setName('')
    toast('Жанр додано')
  }
  const submitRename = (old: string) => {
    const err = rename(old, value)
    if (err) return toast(err)
    setEditing(null)
    toast('Жанр перейменовано')
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 rounded-2xl border border-line bg-surface p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
          placeholder="Новий жанр"
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-bg px-4 text-sm outline-none focus:border-primary"
        />
        <Button className="h-10" onClick={submitAdd}>Додати жанр</Button>
      </div>
      <ul className="mt-4 grid gap-2">
        {genres.map((g) => {
          const used = books.filter((b) => b.genres.includes(g)).length
          return (
            <li key={g} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              {editing === g ? (
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(g); if (e.key === 'Escape') setEditing(null) }}
                  className="h-9 min-w-[160px] flex-1 rounded-lg border border-primary bg-bg px-3 text-sm outline-none"
                />
              ) : (
                <span className="min-w-[160px] flex-1 text-sm font-semibold">{g}</span>
              )}
              <span className="text-xs text-muted">книг: {used}</span>
              {editing === g ? (
                <div className="flex gap-2">
                  <Button className={small} onClick={() => submitRename(g)}><Check size={14} /> Зберегти</Button>
                  <Button variant="outline" className={small} onClick={() => setEditing(null)}>Скасувати</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className={small} onClick={() => { setEditing(g); setValue(g) }}><Pencil size={14} /> Перейменувати</Button>
                  <Button variant="danger" className={small} onClick={() => { const e = del(g); toast(e ?? 'Жанр видалено') }}><Trash2 size={14} /> Видалити</Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Жанр, який використовують книги, видалити не можна — його можна перейменувати (книги оновляться автоматично).</p>
    </>
  )
}

export function Admin() {
  const [tab, setTab] = useState<Tab>('stats')
  return (
    <>
      <PageHeader title="Адмін-панель" subtitle="Керування користувачами, книгами, запитами та довідниками" />
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-line pb-3">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'h-[34px] shrink-0 rounded-lg border px-4 text-sm font-semibold transition',
              tab === t ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface hover:bg-beige/50',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'stats' && <Stats />}
      {tab === 'users' && <Users />}
      {tab === 'books' && <Books />}
      {tab === 'requests' && <Requests />}
      {tab === 'genres' && <Genres />}
    </>
  )
}
