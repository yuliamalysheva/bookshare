import { useMemo, useState } from 'react'
import { Grid3x3, List, Plus, Search, Trash2 } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Chip, Empty, FilterSelect, PageHeader, StatCard } from '../components/ui'
import { BookCover } from '../components/BookCover'
import { AddBookModal } from '../components/AddBookModal'
import { BookViewModal } from '../components/BookModals'
import { useStore, useToast } from '../store'
import { STATUS_LABEL } from '../types'
import type { Book, BookStatus } from '../types'
import { cn } from '../lib/utils'

const tone = { mine: 'success', reserved: 'warn', lent: 'neutral' } as const

function ShelfBook({ book, draggable, onOpen }: { book: Book; draggable: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
    disabled: !draggable,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={cn('shelf-item px-3 pt-3', isDragging && 'opacity-80')}
      {...attributes}
      {...(draggable ? listeners : {})}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn('block w-full text-left', draggable && 'cursor-grab active:cursor-grabbing')}
      >
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
        <div className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-tight">{book.title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{book.author}</div>
        {(book.status !== 'mine' || book.hidden) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {book.status !== 'mine' && <Chip tone={tone[book.status]}>{STATUS_LABEL[book.status]}</Chip>}
            {book.hidden && <Chip tone="danger">Приховано</Chip>}
          </div>
        )}
      </button>
    </div>
  )
}

export function Library() {
  const me = useStore((s) => s.currentUserId)!
  const allBooks = useStore((s) => s.books)
  const GENRES = useStore((s) => s.genres)
  const reorderBooks = useStore((s) => s.reorderBooks)
  const removeBook = useStore((s) => s.removeBook)
  const toast = useToast((s) => s.show)

  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [status, setStatus] = useState<'' | BookStatus>('')
  const [sort, setSort] = useState<'manual' | 'title' | 'author' | 'new'>('manual')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const mine = useMemo(
    () => allBooks.filter((b) => b.ownerId === me).sort((a, b) => a.order - b.order),
    [allBooks, me],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = mine.filter(
      (b) =>
        (!needle ||
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          b.isbn.replace(/-/g, '').includes(needle.replace(/-/g, '')) ||
          b.genres.some((g) => g.toLowerCase().includes(needle))) &&
        (!genre || b.genres.includes(genre)) &&
        (!status || b.status === status),
    )
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'uk'))
    if (sort === 'author') list = [...list].sort((a, b) => a.author.localeCompare(b.author, 'uk'))
    if (sort === 'new') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return list
  }, [mine, q, genre, status, sort])

  const canDrag = sort === 'manual' && !q && !genre && !status && view === 'grid'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = mine.map((b) => b.id)
    reorderBooks(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const count = (s: BookStatus) => mine.filter((b) => b.status === s).length

  return (
    <>
      <PageHeader
        title="Моя бібліотека"
        subtitle="Ваша віртуальна книжкова полиця"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Додати книгу
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <StatCard label="Усього книг" value={mine.length} desc="у вашій колекції" />
        <StatCard label="У мене" value={count('mine')} desc="доступні для передачі" />
        <StatCard label="Заброньовано" value={count('reserved')} desc="очікують передачі" />
        <StatCard label="У позиці" value={count('lent')} desc="зараз у інших читачів" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Назва, автор, ISBN або жанр"
            className="h-10 w-full rounded-xl border border-line bg-bg pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <FilterSelect value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Жанр">
          <option value="">Усі жанри</option>
          {GENRES.map((g) => <option key={g}>{g}</option>)}
        </FilterSelect>
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value as '' | BookStatus)} aria-label="Статус">
          <option value="">Усі статуси</option>
          {(Object.keys(STATUS_LABEL) as BookStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </FilterSelect>
        <FilterSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортування">
          <option value="manual">Мій порядок</option>
          <option value="title">За назвою</option>
          <option value="author">За автором</option>
          <option value="new">Спочатку нові</option>
        </FilterSelect>
        <div className="flex overflow-hidden rounded-xl border border-line">
          {([['grid', Grid3x3], ['list', List]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-label={v === 'grid' ? 'Полиця' : 'Список'}
              className={cn('flex h-10 w-[60px] items-center justify-center', view === v ? 'bg-primary text-primary-fg' : 'bg-surface text-muted')}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Моя полиця</h2>
          <p className="text-xs text-muted">
            {canDrag ? 'Перетягуйте книги, щоб змінити порядок' : 'Скиньте фільтри та оберіть «Мій порядок», щоб перетягувати книги'}
          </p>
        </div>
        <span className="text-xs text-muted">{filtered.length} книг</span>
      </div>

      <div className="mt-3">
        {filtered.length === 0 ? (
          <Empty
            title={mine.length === 0 ? 'Ваша полиця поки порожня' : 'Нічого не знайдено'}
            text={mine.length === 0 ? 'Додайте першу книгу, щоб інші читачі могли її побачити.' : 'Спробуйте змінити пошук або фільтри.'}
            action={mine.length === 0 ? <Button onClick={() => setAdding(true)}><Plus size={16} /> Додати книгу</Button> : undefined}
          />
        ) : view === 'grid' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((b) => b.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 rounded-3xl border border-line bg-beige/30 p-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 sm:p-4">
                {filtered.map((b) => (
                  <ShelfBook key={b.id} book={b} draggable={canDrag} onOpen={() => setOpenId(b.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {filtered.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-3">
                <div className="w-11 shrink-0">
                  <BookCover title={b.title} coverUrl={b.coverUrl} ratio="44/60" size="xs" />
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(b.id)}>
                  <div className="truncate font-semibold">{b.title}</div>
                  <div className="truncate text-xs text-muted">{b.author} · {b.genres.join(', ')}</div>
                </button>
                <Chip tone={tone[b.status]}>{STATUS_LABEL[b.status]}</Chip>{b.hidden && <Chip tone="danger" className="ml-1">Приховано</Chip>}
                <button
                  aria-label="Видалити"
                  disabled={b.status !== 'mine'}
                  className="text-muted hover:text-danger disabled:opacity-30"
                  onClick={() => {
                    if (window.confirm(`Видалити «${b.title}»?`)) {
                      removeBook(b.id)
                      toast('Книгу видалено')
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && <AddBookModal onClose={() => setAdding(false)} />}
      {openId && <BookViewModal bookId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
