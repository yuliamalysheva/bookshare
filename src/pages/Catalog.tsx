import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { Button, Chip, Empty, FilterSelect, PageHeader } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { BookViewModal } from '../components/BookModals'
import { useStore, useToast } from '../store'
import { AVAILABILITY_LABEL } from '../types'
import { cn, initials, isMatch, visibleBooks } from '../lib/utils'

const PAGE = 8
const tone = { mine: 'success', reserved: 'warn', lent: 'neutral' } as const

export function Catalog() {
  const me = useStore((s) => s.currentUserId)!
  const allBooks = useStore((s) => s.books)
  const users = useStore((s) => s.users)
  const GENRES = useStore((s) => s.genres)
  const wishlist = useStore((s) => s.wishlist)
  const addWish = useStore((s) => s.addWish)
  const removeWish = useStore((s) => s.removeWish)
  const toast = useToast((s) => s.show)

  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [terms, setTerms] = useState<'' | 'loan' | 'exchange'>('')
  const [sort, setSort] = useState<'new' | 'title' | 'author'>('new')
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)

  const books = useMemo(() => visibleBooks(allBooks, users), [allBooks, users])
  const myWishes = useMemo(() => wishlist.filter((w) => w.userId === me), [wishlist, me])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = books.filter(
      (b) =>
        b.ownerId !== me &&
        (!needle ||
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          b.isbn.replace(/-/g, '').includes(needle.replace(/-/g, '')) ||
          b.genres.some((g) => g.toLowerCase().includes(needle))) &&
        (!genre || b.genres.includes(genre)) &&
        (!terms || b[terms]),
    )
    if (sort === 'title') out = [...out].sort((a, b) => a.title.localeCompare(b.title, 'uk'))
    else if (sort === 'author') out = [...out].sort((a, b) => a.author.localeCompare(b.author, 'uk'))
    else out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return out
  }, [books, me, q, genre, terms, sort])

  const toggleWish = (bookId: string) => {
    const b = books.find((x) => x.id === bookId)!
    const existing = myWishes.find((w) => isMatch(w, b))
    if (existing) {
      removeWish(existing.id)
      toast('Прибрано зі списку бажаного')
    } else {
      addWish({ title: b.title, author: b.author, isbn: b.isbn, coverUrl: b.coverUrl })
      toast('Додано до списку бажаного')
    }
  }

  return (
    <>
      <PageHeader title="Каталог книг" subtitle="Знайдіть книгу в бібліотеках читачів міста" />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
            placeholder="Назва, автор, ISBN або жанр"
            className="h-10 w-full rounded-xl border border-line bg-bg pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <FilterSelect value={genre} onChange={(e) => { setGenre(e.target.value); setLimit(PAGE) }} aria-label="Жанр">
          <option value="">Усі жанри</option>
          {GENRES.map((g) => <option key={g}>{g}</option>)}
        </FilterSelect>
        <FilterSelect value={terms} onChange={(e) => { setTerms(e.target.value as typeof terms); setLimit(PAGE) }} aria-label="Умови">
          <option value="">Позика та обмін</option>
          <option value="loan">Лише позика</option>
          <option value="exchange">Лише обмін</option>
        </FilterSelect>
        <FilterSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортування">
          <option value="new">Спочатку нові</option>
          <option value="title">За назвою</option>
          <option value="author">За автором</option>
        </FilterSelect>
      </div>

      <div className="mt-5 text-right text-xs text-muted">Знайдено: {list.length}</div>

      {list.length === 0 ? (
        <div className="mt-3">
          <Empty title="Нічого не знайдено" text="Спробуйте змінити пошуковий запит або фільтри." />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {list.slice(0, limit).map((b) => {
            const owner = users.find((u) => u.id === b.ownerId)
            const wished = myWishes.some((w) => isMatch(w, b))
            return (
              <div key={b.id} className="flex flex-col rounded-2xl border border-line bg-surface p-3 shadow-card transition hover:-translate-y-0.5 sm:p-4">
                <button className="relative block text-left" onClick={() => setOpenId(b.id)}>
                  <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} ratio="148/130" />
                  <Chip tone={tone[b.status]} className="absolute right-2 top-2 bg-surface/95">
                    {AVAILABILITY_LABEL[b.status]}
                  </Chip>
                </button>
                <button className="mt-3 text-left" onClick={() => setOpenId(b.id)}>
                  <div className="line-clamp-2 min-h-[2.25rem] text-sm font-semibold leading-tight">{b.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{b.author}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">{b.genres.join(', ')}</div>
                </button>
                <div className="mt-2 flex gap-1.5">
                  {b.loan && <Chip tone="primary">Позика</Chip>}
                  {b.exchange && <Chip tone="warn">Обмін</Chip>}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Link to={`/user/${b.ownerId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary" title="Переглянути профіль">
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-ink">
                      {initials(owner?.name ?? '')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">{owner?.name.split(' ')[0]}</span>
                  </Link>
                  <button
                    aria-label={wished ? 'Прибрати з бажаного' : 'Додати до бажаного'}
                    onClick={() => toggleWish(b.id)}
                    className={cn('transition', wished ? 'text-danger' : 'text-muted hover:text-danger')}
                  >
                    <Heart size={18} fill={wished ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {list.length > limit && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="w-60" onClick={() => setLimit(limit + PAGE)}>Показати ще</Button>
        </div>
      )}

      {openId && <BookViewModal bookId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
