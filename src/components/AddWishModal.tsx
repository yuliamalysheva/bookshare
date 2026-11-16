import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, WifiOff } from 'lucide-react'
import { Button, Modal, TextField } from './ui'
import { BookCover } from './BookCover'
import { useStore, useToast } from '../store'
import { searchBooks, type OLBook } from '../lib/openlibrary'
import { normalize } from '../lib/utils'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function AddWishModal({ onClose }: { onClose: () => void }) {
  const addWish = useStore((s) => s.addWish)
  const wishlist = useStore((s) => s.wishlist)
  const me = useStore((s) => s.currentUserId)
  const toast = useToast((s) => s.show)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OLBook[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [manual, setManual] = useState(false)

  // ручне додавання
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [error, setError] = useState('')

  const inList = useMemo(
    () => new Set(wishlist.filter((w) => w.userId === me).map((w) => `${normalize(w.title)}|${normalize(w.author)}`)),
    [wishlist, me],
  )

  // Пошук із затримкою, щоб не слати запит на кожну літеру
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const found = await searchBooks(q, ctrl.signal)
        setResults(found)
        setStatus('done')
        if (found.length === 0) setManual(true)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setResults([])
        setStatus('error')
        setManual(true)
      }
    }, 450)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const pick = (b: OLBook) => {
    const err = addWish({ title: b.title, author: b.author, isbn: b.isbn, coverUrl: b.coverUrl, year: b.year })
    if (err) return toast(err)
    toast('Книгу додано до списку бажаного')
    onClose()
  }

  const submitManual = () => {
    if (!title.trim()) return setError('Вкажіть назву книги')
    const err = addWish({ title, author, isbn })
    if (err) return setError(err)
    toast('Книгу додано до списку бажаного')
    onClose()
  }

  return (
    <Modal
      wide
      title="Додати до бажаного"
      subtitle="Знайдіть книгу за назвою, автором або ISBN — ми повідомимо, коли вона з'явиться в чиїйсь бібліотеці"
      onClose={onClose}
      footer={
        manual ? (
          <>
            <Button variant="outline" onClick={onClose}>Скасувати</Button>
            <Button onClick={submitManual}>Додати вручну</Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Закрити</Button>
        )
      }
    >
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Наприклад: Дюна, Герберт або 9780441172719"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-11 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {status === 'loading' && (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" />
        )}
      </div>

      <div className="mt-4">
        {status === 'idle' && (
          <p className="text-sm text-muted">Введіть щонайменше 2 символи, щоб почати пошук.</p>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
            <WifiOff size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <div className="font-semibold">Не вдалося виконати пошук</div>
              <div className="text-muted">Перевірте інтернет-з'єднання або додайте книгу вручну нижче.</div>
            </div>
          </div>
        )}

        {status === 'done' && results.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
            Нічого не знайдено. Спробуйте іншу назву або додайте книгу вручну нижче.
          </p>
        )}

        {results.length > 0 && (
          <ul className="grid max-h-[340px] grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden pr-1">
            {results.map((b) => {
              const already = inList.has(`${normalize(b.title)}|${normalize(b.author)}`)
              return (
                <li key={b.key} className="min-w-0">
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => pick(b)}
                    className="group flex w-full min-w-0 items-center gap-4 rounded-xl border border-line p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-transparent"
                  >
                    <div className="w-12 shrink-0">
                      <BookCover title={b.title} coverUrl={b.coverUrl} ratio="48/68" size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{b.title}</div>
                      <div className="truncate text-xs text-muted">{b.author || 'Автор невідомий'}</div>
                      <div className="text-xs text-muted">{b.year ? `${b.year} р.` : 'Рік невідомий'}</div>
                    </div>
                    <span
                      className={
                        already
                          ? 'shrink-0 text-xs text-muted'
                          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition group-hover:scale-110'
                      }
                      aria-hidden
                    >
                      {already ? 'У списку' : <Plus size={16} />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {!manual ? (
          <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setManual(true)}>
            Не знайшли книгу? Додати вручну
          </button>
        ) : (
          <div>
            <div className="text-sm font-semibold">Додати вручну</div>
            <div className="mt-3 grid gap-4">
              <TextField
                label="Назва книги"
                required
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError('') }}
                error={error}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Автор" optional value={author} onChange={(e) => setAuthor(e.target.value)} />
                <TextField label="ISBN" optional value={isbn} onChange={(e) => setIsbn(e.target.value)} hint="Для точнішого пошуку збігів" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
