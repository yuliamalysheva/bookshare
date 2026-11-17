import { useState } from 'react'
import { ImagePlus, PencilLine, ScanBarcode, Search, CheckCircle2 } from 'lucide-react'
import { Button, Modal, SelectField, TextArea, TextField } from './ui'
import { BookCover } from './BookCover'
import { useStore, useToast } from '../store'
import type { Book } from '../types'
import { cn, fileToDataUrl, isValidIsbn } from '../lib/utils'

type Mode = 'manual' | 'isbn'
type Terms = 'loan' | 'exchange' | 'both'

const OL_GENRE_MAP: Array<[RegExp, string]> = [
  [/science fiction|sci-fi|фантаст/i, 'Фантастика'],
  [/fantasy|фентез/i, 'Фентезі'],
  [/adventure|пригод/i, 'Пригоди'],
  [/dystopi|антиутоп/i, 'Антиутопія'],
  [/romance|романт/i, 'Романтика'],
  [/detective|mystery|детектив/i, 'Детектив'],
  [/history|істор/i, 'Історія'],
  [/classic|класик/i, 'Класика'],
]

async function lookupIsbn(isbn: string) {
  const clean = isbn.replace(/[^0-9xX]/g, '')
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`)
  if (!res.ok) throw new Error('network')
  const json = await res.json()
  const data = json[`ISBN:${clean}`]
  if (!data) return null
  const subjects: string[] = (data.subjects ?? []).map((s: { name: string }) => s.name)
  const genre = OL_GENRE_MAP.find(([re]) => subjects.some((s) => re.test(s)))?.[1] ?? ''
  return {
    title: data.title as string,
    author: (data.authors?.[0]?.name as string) ?? '',
    coverUrl: (data.cover?.medium as string | undefined) ?? undefined,
    genre,
    genres: genre ? [genre] : [],
  }
}

const termsOf = (b?: Book): Terms => (!b || (b.loan && b.exchange) || (!b.loan && !b.exchange) ? 'both' : b.loan ? 'loan' : 'exchange')

/** Додавання нової книги або (якщо передано `book`) редагування існуючої. */
export function AddBookModal({ onClose, book }: { onClose: () => void; book?: Book }) {
  const editing = !!book
  const addBook = useStore((s) => s.addBook)
  const updateBook = useStore((s) => s.updateBook)
  const books = useStore((s) => s.books)
  const GENRES = useStore((s) => s.genres)
  const toast = useToast((s) => s.show)

  const [mode, setMode] = useState<Mode>('manual')
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [isbn, setIsbn] = useState(book?.isbn ?? '')
  const [genres, setGenres] = useState<string[]>(book?.genres ?? [])
  const [description, setDescription] = useState(book?.description ?? '')
  const [coverUrl, setCoverUrl] = useState<string | undefined>(book?.coverUrl)
  const [terms, setTerms] = useState<Terms>(termsOf(book))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [found, setFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const search = async () => {
    setSearchError('')
    setFound(false)
    if (!isValidIsbn(isbn)) {
      setSearchError('Введіть коректний ISBN (10 або 13 цифр)')
      return
    }
    setSearching(true)
    try {
      const clean = isbn.replace(/[^0-9xX]/g, '')
      let result = await lookupIsbn(isbn).catch(() => null)
      if (!result) {
        // запасний варіант — книги, що вже є в застосунку
        const local = books.find((b) => b.isbn.replace(/[^0-9xX]/g, '') === clean)
        if (local) result = { title: local.title, author: local.author, coverUrl: local.coverUrl, genre: '', genres: local.genres }
      }
      if (result) {
        setTitle(result.title)
        setAuthor(result.author)
        if (result.coverUrl) setCoverUrl(result.coverUrl)
        const guessed = result.genres.filter((g: string) => GENRES.includes(g))
        if (guessed.length) setGenres((cur) => [...new Set([...cur, ...guessed])])
        setFound(true)
      } else {
        setSearchError('Книгу не знайдено. Заповніть поля вручну.')
      }
    } finally {
      setSearching(false)
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      setCoverUrl(await fileToDataUrl(f))
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const submit = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Вкажіть назву книги'
    if (!author.trim()) e.author = 'Вкажіть автора'
    if (!isValidIsbn(isbn)) e.isbn = 'ISBN має містити 10 або 13 цифр'
    if (genres.length === 0) e.genre = 'Оберіть хоча б один жанр'
    setErrors(e)
    if (Object.keys(e).length) return
    const data = {
      title,
      author,
      isbn,
      genres,
      description,
      coverUrl,
      loan: terms !== 'exchange',
      exchange: terms !== 'loan',
    }
    if (book) {
      const err = updateBook(book.id, data)
      if (err) return toast(err)
      toast('Зміни збережено')
    } else {
      const err = addBook(data)
      if (err) return toast(err)
      toast('Книгу додано до бібліотеки')
    }
    onClose()
  }

  const methodBtn = (m: Mode, icon: React.ReactNode, label: string, desc: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-4 text-left transition',
        mode === m ? 'border-primary bg-primary/5' : 'border-line hover:bg-beige/40',
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/40 text-primary">{icon}</span>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  )

  const termOpt = (v: Terms, label: string, desc: string) => (
    <button
      type="button"
      onClick={() => setTerms(v)}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left',
        terms === v ? 'border-primary bg-primary/5' : 'border-line',
      )}
    >
      <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full border-2', terms === v ? 'border-primary' : 'border-line')}>
        {terms === v && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  )

  return (
    <Modal
      wide
      title={editing ? 'Редагувати книгу' : 'Додати книгу'}
      subtitle={editing ? 'Змініть дані про книгу у вашій бібліотеці' : 'Додайте книгу до своєї віртуальної полиці'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Скасувати</Button>
          <Button onClick={submit}>{editing ? 'Зберегти зміни' : 'Додати книгу'}</Button>
        </>
      }
    >
      {!editing && (
        <>
          <div className="text-sm font-semibold">Як ви хочете додати книгу?</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {methodBtn('manual', <PencilLine size={18} />, 'Вручну', 'Заповніть дані про книгу самостійно')}
            {methodBtn('isbn', <ScanBarcode size={18} />, 'За ISBN', 'Дані підтягнуться автоматично')}
          </div>
        </>
      )}

      {!editing && mode === 'isbn' && (
        <div className="mt-5 rounded-2xl border border-line p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label="ISBN"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-0-441-17271-9"
                error={searchError}
              />
            </div>
            <Button className="mt-[26px]" onClick={search} disabled={searching}>
              <Search size={16} /> {searching ? 'Пошук…' : 'Знайти'}
            </Button>
          </div>
          {found && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <CheckCircle2 size={14} /> Книгу знайдено — перевірте дані нижче
            </div>
          )}
        </div>
      )}

      <div className={cn('grid gap-5 sm:grid-cols-[180px_1fr]', !editing && 'mt-5')}>
        <div>
          <div className="mb-1.5 text-xs font-semibold">Обкладинка</div>
          {coverUrl ? (
            <BookCover title={title || 'Назва'} coverUrl={coverUrl} ratio="180/194" />
          ) : (
            <label className="flex aspect-[180/194] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-center text-xs text-muted hover:bg-beige/40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/40 text-primary">
                <ImagePlus size={20} />
              </span>
              <span className="font-semibold text-ink">Завантажити обкладинку</span>
              <span>JPG, PNG</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
          {coverUrl && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <label className="cursor-pointer text-primary hover:underline">
                Замінити
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              <button className="text-primary hover:underline" onClick={() => setCoverUrl(undefined)}>
                Прибрати
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-4">
          <TextField label="Назва книги" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="Наприклад, Дюна" />
          <TextField label="Автор" required value={author} onChange={(e) => setAuthor(e.target.value)} error={errors.author} placeholder="Френк Герберт" />
          <div className="grid gap-4 sm:grid-cols-2">
            {(editing || mode === 'manual') && (
              <TextField label="ISBN" required value={isbn} onChange={(e) => setIsbn(e.target.value)} error={errors.isbn} placeholder="978…" />
            )}
            {!editing && mode === 'isbn' && errors.isbn && <p className="text-xs text-danger sm:col-span-2">{errors.isbn}</p>}
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold">Жанри <span className="text-danger">*</span> <span className="font-normal text-muted">можна обрати кілька</span></div>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = genres.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGenres(on ? genres.filter((x) => x !== g) : [...genres, g])}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${on ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-beige/50'}`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
            {errors.genre && <span className="mt-1 block text-xs text-danger">{errors.genre}</span>}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <TextArea
          label="Опис"
          optional
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Коротко про книгу"
          hint={`${description.length}/500`}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold">
          Спосіб отримання <span className="text-danger">*</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {termOpt('loan', 'Позика', 'Тимчасово віддам')}
          {termOpt('exchange', 'Обмін', 'На іншу книгу')}
          {termOpt('both', 'Обидва варіанти', 'Позика та обмін')}
        </div>
      </div>
    </Modal>
  )
}
