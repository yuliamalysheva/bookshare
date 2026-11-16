import type { Book, BookRequest, User, WishItem } from '../types'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()

const normIsbn = (s: string) => s.replace(/[^0-9xX]/g, '').toLowerCase()

export function isMatch(w: Pick<WishItem, 'title' | 'author' | 'isbn'>, b: Book): boolean {
  const wi = normIsbn(w.isbn || '')
  const bi = normIsbn(b.isbn || '')
  if (wi && bi && wi === bi) return true
  if (normalize(w.title) !== normalize(b.title)) return false
  const wa = normalize(w.author || '')
  const ba = normalize(b.author || '')
  return !wa || !ba || wa === ba
}

export interface Match {
  wish: WishItem
  book: Book
}

/** Книги зі списку бажаного користувача, які доступні в бібліотеках інших. */
/** Книги, які бачать читачі: без прихованих і без книг заблокованих власників. */
export function visibleBooks(books: Book[], users: User[]): Book[] {
  const blocked = new Set(users.filter((u) => u.blocked).map((u) => u.id))
  return books.filter((b) => !b.hidden && !blocked.has(b.ownerId))
}

export function findMatches(wishlist: WishItem[], books: Book[], userId: string): Match[] {
  const out: Match[] = []
  for (const wish of wishlist) {
    if (wish.userId !== userId) continue
    for (const book of books) {
      if (book.ownerId === userId || book.status !== 'mine') continue
      if (isMatch(wish, book)) out.push({ wish, book })
    }
  }
  return out
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв тому`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} год тому`
  const d = Math.floor(h / 24)
  return `${d} дн тому`
}

export const initials = (name: string) => (name.trim()[0] || '?').toUpperCase()

export const isValidIsbn = (s: string) => {
  const n = normIsbn(s)
  return n.length === 10 || n.length === 13
}

/** Стискає зображення до даних data URL, щоб не переповнити LocalStorage. */
export function fileToDataUrl(file: File, maxSide = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не вдалося прочитати файл'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Невірний формат зображення'))
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export interface UserStats {
  completed: number
  exchanges: number
  loans: number
  gave: number
  received: number
  answerRate: number | null
  level: 'new' | 'some' | 'trusted'
}

/** Показники довіри: за завершеними запитами та швидкістю відповідей. */
export function userStats(userId: string, requests: BookRequest[]): UserStats {
  const mine = requests.filter((r) => r.fromUserId === userId || r.toUserId === userId)
  const done = mine.filter((r) => r.status === 'completed')
  const incoming = mine.filter((r) => r.toUserId === userId && r.status !== 'cancelled')
  const answered = incoming.filter((r) => r.status !== 'pending').length
  const completed = done.length
  return {
    completed,
    exchanges: done.filter((r) => r.type === 'exchange').length,
    loans: done.filter((r) => r.type === 'loan').length,
    gave: done.filter((r) => r.toUserId === userId).length,
    received: done.filter((r) => r.fromUserId === userId).length,
    answerRate: incoming.length ? Math.round((answered / incoming.length) * 100) : null,
    level: completed >= 3 ? 'trusted' : completed >= 1 ? 'some' : 'new',
  }
}
