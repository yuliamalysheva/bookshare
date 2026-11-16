import { useMemo, useState } from 'react'
import { Check, Heart, Plus, Search } from 'lucide-react'
import { Button, Chip, Empty, FilterSelect, Modal, PageHeader } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { AddWishModal } from '../components/AddWishModal'
import { BookViewModal } from '../components/BookModals'
import { useStore, useToast } from '../store'
import { findMatches, initials, userStats, visibleBooks } from '../lib/utils'

export function Wishlist() {
  const me = useStore((s) => s.currentUserId)!
  const wishlist = useStore((s) => s.wishlist)
  const allBooks = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const removeWish = useStore((s) => s.removeWish)
  const toast = useToast((s) => s.show)

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'available' | 'waiting'>('all')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [chooseId, setChooseId] = useState<string | null>(null)
  const requests = useStore((s) => s.requests)

  const books = useMemo(() => visibleBooks(allBooks, users), [allBooks, users])
  const mine = useMemo(() => wishlist.filter((w) => w.userId === me), [wishlist, me])
  const matches = useMemo(() => findMatches(mine, books, me), [mine, books, me])

  const items = mine.filter((w) => {
    const needle = q.trim().toLowerCase()
    const matched = matches.some((m) => m.wish.id === w.id)
    return (
      (!needle || w.title.toLowerCase().includes(needle) || w.author.toLowerCase().includes(needle)) &&
      (filter === 'all' || (filter === 'available' ? matched : !matched))
    )
  })

  return (
    <>
      <PageHeader
        title="Список бажаного"
        subtitle="Книги, які ви хочете прочитати. Ми автоматично шукаємо їх у бібліотеках інших."
        action={<Button onClick={() => setAdding(true)}><Plus size={16} /> Додати книгу</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук у списку бажаного"
            className="h-10 w-full rounded-xl border border-line bg-bg pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <FilterSelect value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Фільтр">
          <option value="all">Усі книги</option>
          <option value="available">Є в бібліотеках</option>
          <option value="waiting">Ще не знайдено</option>
        </FilterSelect>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Хочу прочитати</h2>
          <p className="text-xs text-muted">Зелена позначка означає, що книгу вже можна отримати</p>
        </div>
        <span className="text-xs text-muted">{items.length} книг</span>
      </div>

      <div className="mt-3">
        {items.length === 0 ? (
          <Empty
            title={mine.length === 0 ? 'Список бажаного порожній' : 'Нічого не знайдено'}
            text={mine.length === 0 ? 'Додайте книги вручну або натисніть ♡ у каталозі.' : undefined}
            action={mine.length === 0 ? <Button onClick={() => setAdding(true)}><Plus size={16} /> Додати книгу</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 rounded-3xl border border-line bg-beige/30 p-2 sm:grid-cols-3 sm:p-4 md:grid-cols-4 xl:grid-cols-5">
            {items.map((w) => {
              const found = matches.filter((m) => m.wish.id === w.id)
              const match = found[0]
              return (
                <div key={w.id} className="shelf-item px-3 pt-3">
                  <div className="relative">
                    <button
                      className="block w-full text-left"
                      disabled={!match}
                      onClick={() => (found.length > 1 ? setChooseId(w.id) : match && setOpenId(match.book.id))}
                      aria-label={match ? `Переглянути «${w.title}»${found.length > 1 ? ` — у ${found.length} читачів` : ''}` : w.title}
                    >
                      <BookCover title={w.title} author={w.author} coverUrl={w.coverUrl} />
                    </button>
                    {match && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-success px-1 text-xs font-bold text-white shadow">
                        {found.length > 1 ? found.length : <Check size={14} />}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] font-semibold leading-tight">{w.title}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {w.author || '—'}{w.year ? ` · ${w.year}` : ''}
                      </div>
                    </div>
                    <button
                      aria-label="Прибрати з бажаного"
                      className="text-danger"
                      onClick={() => { removeWish(w.id); toast('Прибрано зі списку бажаного') }}
                    >
                      <Heart size={17} fill="currentColor" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {adding && <AddWishModal onClose={() => setAdding(false)} />}
      {chooseId && (() => {
        const wish = mine.find((w) => w.id === chooseId)
        const options = matches.filter((m) => m.wish.id === chooseId)
        if (!wish || options.length === 0) return null
        return (
          <Modal
            title={`«${wish.title}»`}
            subtitle={`Ця книга є у ${options.length} читачів — оберіть, у кого переглянути`}
            onClose={() => setChooseId(null)}
            footer={<Button variant="outline" onClick={() => setChooseId(null)}>Закрити</Button>}
          >
            <ul className="grid grid-cols-1 gap-2">
              {options.map(({ book }) => {
                const owner = users.find((u) => u.id === book.ownerId)
                const st = userStats(book.ownerId, requests)
                return (
                  <li key={book.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => { setChooseId(null); setOpenId(book.id) }}
                      className="flex w-full min-w-0 items-center gap-4 rounded-xl border border-line p-3 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage font-bold text-ink">{initials(owner?.name ?? '')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{owner?.name}</span>
                        <span className="block truncate text-xs text-muted">{owner?.city || '—'} · завершених угод: {st.completed}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {book.loan && <Chip tone="primary">Позика</Chip>}
                          {book.exchange && <Chip tone="warn">Обмін</Chip>}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Modal>
        )
      })()}
      {openId && <BookViewModal bookId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
