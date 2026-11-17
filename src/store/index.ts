import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Book, BookRequest, Notif, RequestType, Review, Role, User, WishItem } from '../types'
import { DEFAULT_GENRES } from '../types'
import { seedBooks, seedNotifications, seedRequests, seedReviews, seedUsers, seedWishlist } from '../data/seed'
import { findMatches, isMatch, normalize, uid, visibleBooks } from '../lib/utils'

export interface NewBook {
  title: string
  author: string
  isbn: string
  genres: string[]
  description: string
  coverUrl?: string
  loan: boolean
  exchange: boolean
}

interface State {
  users: User[]
  currentUserId: string | null
  books: Book[]
  wishlist: WishItem[]
  requests: BookRequest[]
  notifications: Notif[]
  theme: 'light' | 'dark'
  genres: string[]
  reviews: Review[]

  login: (email: string, password: string) => string | null
  register: (d: { name: string; email: string; password: string; city: string }) => string | null
  logout: () => void
  deleteAccount: () => void
  updateProfile: (p: Partial<Pick<User, 'name' | 'email' | 'city' | 'genres' | 'notifyOn' | 'contacts'>>) => string | null
  toggleTheme: () => void

  addBook: (d: NewBook) => string | null
  updateBook: (id: string, d: NewBook) => string | null
  removeBook: (id: string) => void
  reorderBooks: (ids: string[]) => void

  addWish: (d: { title: string; author: string; isbn: string; coverUrl?: string; year?: number }) => string | null
  removeWish: (id: string) => void

  sendRequest: (d: {
    type: RequestType
    bookId: string
    offeredBookId?: string
    returnDate?: string
    message: string
  }) => string | null
  respondRequest: (id: string, accept: boolean, newOfferedBookId?: string) => string | null
  cancelRequest: (id: string) => void
  markLent: (id: string) => void
  completeRequest: (id: string) => void
  addReview: (requestId: string, rating: number, comment: string) => string | null
  deleteReview: (id: string) => void

  markRead: (id: string) => void
  markAllRead: () => void

  // --- адміністратор ---
  adminSetBlocked: (userId: string, blocked: boolean) => string | null
  adminDeleteUser: (userId: string) => string | null
  adminSetRole: (userId: string, role: Role) => string | null
  adminToggleHidden: (bookId: string) => void
  adminCancelRequest: (id: string) => void
  addGenre: (name: string) => string | null
  renameGenre: (oldName: string, newName: string) => string | null
  deleteGenre: (name: string) => string | null
}

const now = () => new Date().toISOString()

/** Створює сповіщення «Збіг!» без дублікатів. */
function withMatchNotifs(
  users: User[],
  books: Book[],
  wishlist: WishItem[],
  notifications: Notif[],
  userIds: string[],
  freed?: Set<string>,
): Notif[] {
  const next = [...notifications]
  const shown = visibleBooks(books, users)
  for (const userId of userIds) {
    const user = users.find((u) => u.id === userId)
    if (!user || !user.notifyOn || user.blocked) continue
    for (const m of findMatches(wishlist, shown, userId)) {
      if (freed?.has(m.book.id)) {
        // книга знову стала доступною — це нова подія, дублікат не блокуємо
        next.unshift({ id: uid(), userId, type: 'match', bookId: m.book.id, key: `match:${userId}:${m.book.id}:back:${now()}`, back: true, read: false, createdAt: now() })
        continue
      }
      const key = `match:${userId}:${m.book.id}`
      if (next.some((n) => n.key === key)) continue
      next.unshift({ id: uid(), userId, type: 'match', bookId: m.book.id, key, read: false, createdAt: now() })
    }
  }
  return next
}

const availableIds = (books: Book[], users: User[]) =>
  new Set(visibleBooks(books, users).filter((b) => b.status === 'mine').map((b) => b.id))

/** Якщо внаслідок зміни якісь книги знову стали доступними — сповіщає тих, хто їх чекав. */
function applyFreed(s: State, patch: Partial<State>): Partial<State> {
  const books = patch.books ?? s.books
  const users = patch.users ?? s.users
  const before = availableIds(s.books, s.users)
  const freed = new Set([...availableIds(books, users)].filter((id) => !before.has(id) && s.books.some((b) => b.id === id)))
  if (freed.size === 0) return patch
  const notifications = withMatchNotifs(users, books, patch.wishlist ?? s.wishlist, patch.notifications ?? s.notifications, users.map((u) => u.id), freed)
  return { ...patch, notifications }
}

const isAdminNow = (s: State) => s.users.find((u) => u.id === s.currentUserId)?.role === 'admin'
const NO_RIGHTS = 'Недостатньо прав'
const normIsbnLocal = (v: string) => v.replace(/[^0-9xX]/g, '').toUpperCase()

/** Чи є в цього власника така сама книга (за ISBN або назвою й автором). */
const hasDuplicate = (books: Book[], ownerId: string, d: NewBook, exceptId?: string) =>
  books.some(
    (b) =>
      b.ownerId === ownerId &&
      b.id !== exceptId &&
      ((normIsbnLocal(d.isbn) !== '' && normIsbnLocal(b.isbn) === normIsbnLocal(d.isbn)) ||
        (normalize(b.title) === normalize(d.title) && normalize(b.author) === normalize(d.author))),
  )

const closedNotif = (userId: string, bookTitle: string, reason: Notif['reason'], requestId?: string): Notif => ({
  id: uid(), userId, type: 'request_closed', bookTitle, reason, requestId, read: false, createdAt: now(),
})

/**
 * Закриває всі активні запити користувача (блокування / видалення акаунта):
 * очікувані скасовуються або відхиляються, підтверджені скасовуються, книги звільняються,
 * друга сторона отримує сповіщення.
 */
function closeRequestsOf(s: State, userId: string, reason: 'blocked' | 'deleted', keepRequestId: boolean) {
  const affected = s.requests.filter(
    (r) => (r.fromUserId === userId || r.toUserId === userId) && (r.status === 'pending' || r.status === 'accepted'),
  )
  const ids = new Set(affected.map((r) => r.id))
  const free = new Set<string>()
  const notifs: Notif[] = []
  for (const r of affected) {
    if (r.status === 'accepted') { free.add(r.bookId); if (r.offeredBookId) free.add(r.offeredBookId) }
    const other = r.fromUserId === userId ? r.toUserId : r.fromUserId
    notifs.push(closedNotif(other, s.books.find((b) => b.id === r.bookId)?.title ?? '', reason, keepRequestId ? r.id : undefined))
  }
  return { affected, ids, free, notifs }
}

/** Прибирає користувача та все, що з ним пов'язано. */
function purgeUser(s: State, id: string): Partial<State> {
  const closing = closeRequestsOf(s, id, 'deleted', false)
  const bookIds = new Set(s.books.filter((b) => b.ownerId === id).map((b) => b.id))
  // завершені угоди лишаються в історії інших; решта запитів з цим користувачем зникає
  const touches = (r: BookRequest) =>
    r.fromUserId === id || r.toUserId === id || bookIds.has(r.bookId) || (!!r.offeredBookId && bookIds.has(r.offeredBookId))
  const droppedIds = new Set(s.requests.filter((r) => touches(r) && r.status !== 'completed').map((r) => r.id))
  return {
    users: s.users.filter((u) => u.id !== id),
    books: s.books
      .filter((b) => b.ownerId !== id)
      .map((b) => (closing.free.has(b.id) && b.status !== 'mine' ? { ...b, status: 'mine' as const } : b)),
    wishlist: s.wishlist.filter((w) => w.userId !== id),
    requests: s.requests.filter((r) => !droppedIds.has(r.id)),
    notifications: [
      ...closing.notifs,
      ...s.notifications.filter((n) => n.userId !== id && !(n.requestId && droppedIds.has(n.requestId))),
    ],
    // відгуки про видаленого зникають, його власні відгуки про інших лишаються
    reviews: s.reviews.filter((r) => r.toUserId !== id),
  }
}

const adminCount = (users: User[]) => users.filter((u) => u.role === 'admin' && !u.blocked).length

const SESSION_KEY = 'bookshare:session'
const STORAGE_KEY = 'bookshare:v1'

/** Хто увійшов — зберігаємо окремо для кожної вкладки, щоб у двох вкладках можна було бути різними користувачами. */
const readSession = (): string | null => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
  } catch {
    return null
  }
}

/** LocalStorage може бути недоступним або переповненим — тоді застосунок просто працює без збереження. */
const safeStorage = {
  getItem: (k: string) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  setItem: (k: string, v: string) => {
    try { localStorage.setItem(k, v) } catch { /* переповнено або заборонено */ }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  },
}

/** Повністю скидає демо-дані та перезавантажує сторінку. */
export function resetDemoData() {
  safeStorage.removeItem(STORAGE_KEY)
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  location.reload()
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      users: seedUsers,
      currentUserId: readSession(),
      books: seedBooks,
      wishlist: seedWishlist,
      requests: seedRequests,
      notifications: seedNotifications,
      theme: 'light',
      genres: DEFAULT_GENRES,
      reviews: seedReviews,

      login: (email, password) => {
        const user = get().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user || user.password !== password) return 'Невірна електронна пошта або пароль'
        if (user.blocked) return 'Ваш акаунт заблоковано адміністратором. Зверніться до підтримки.'
        set({ currentUserId: user.id })
        return null
      },

      register: ({ name, email, password, city }) => {
        const { users } = get()
        if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
          return 'Користувач з такою поштою вже існує'
        const user: User = {
          id: uid(),
          name: name.trim(),
          email: email.trim(),
          password,
          city: city.trim(),
          genres: [],
          notifyOn: true,
          role: 'user',
          createdAt: now(),
        }
        set({ users: [...users, user], currentUserId: user.id })
        return null
      },

      logout: () => set({ currentUserId: null }),

      deleteAccount: () => {
        const me = get().currentUserId
        if (!me) return
        const s = get()
        const self = s.users.find((u) => u.id === me)
        if (self?.role === 'admin' && adminCount(s.users) <= 1) return
        set({ ...purgeUser(s, me), currentUserId: null })
      },

      updateProfile: (p) => {
        const s = get()
        const me = s.currentUserId
        if (p.email && s.users.some((u) => u.id !== me && u.email.toLowerCase() === p.email!.toLowerCase()))
          return 'Ця пошта вже зайнята'
        set({ users: s.users.map((u) => (u.id === me ? { ...u, ...p } : u)) })
        return null
      },

      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      addBook: (d) => {
        const s = get()
        const me = s.currentUserId!
        if (hasDuplicate(s.books, me, d)) return 'Така книга вже є у вашій бібліотеці'
        const mine = s.books.filter((b) => b.ownerId === me)
        const book: Book = {
          id: uid(),
          ownerId: me,
          title: d.title.trim(),
          author: d.author.trim(),
          isbn: d.isbn.trim(),
          genres: d.genres,
          description: d.description.trim(),
          coverUrl: d.coverUrl,
          status: 'mine',
          loan: d.loan,
          exchange: d.exchange,
          order: mine.length ? Math.max(...mine.map((b) => b.order)) + 1 : 0,
          createdAt: now(),
        }
        const books = [...s.books, book]
        const others = s.users.filter((u) => u.id !== me).map((u) => u.id)
        set({ books, notifications: withMatchNotifs(s.users, books, s.wishlist, s.notifications, others) })
        return null
      },

      updateBook: (id, d) => {
        const s = get()
        const old = s.books.find((b) => b.id === id)
        const actor = s.users.find((u) => u.id === s.currentUserId)
        if (!old || (old.ownerId !== s.currentUserId && actor?.role !== 'admin')) return 'Книгу не знайдено'
        if (hasDuplicate(s.books, old.ownerId, d, id)) return 'Така книга вже є у вашій бібліотеці'
        const books = s.books.map((b) =>
          b.id === id
            ? {
                ...b,
                title: d.title.trim(),
                author: d.author.trim(),
                isbn: d.isbn.trim(),
                genres: d.genres,
                description: d.description.trim(),
                coverUrl: d.coverUrl,
                loan: d.loan,
                exchange: d.exchange,
              }
            : b,
        )
        // очікувані запити, що більше не відповідають умовам книги, закриваємо
        const closedIds = new Set<string>()
        const closeNotifs: Notif[] = []
        const requests = s.requests.map((r) => {
          if (r.status !== 'pending') return r
          const asRequested = r.bookId === id && ((r.type === 'loan' && !d.loan) || (r.type === 'exchange' && !d.exchange))
          const asOffered = r.offeredBookId === id && !d.exchange
          if (!asRequested && !asOffered) return r
          closedIds.add(r.id)
          // якщо змінили запитану книгу — відхиляємо запит; якщо запропоновану — запит знято
          closeNotifs.push(closedNotif(asRequested ? r.fromUserId : r.toUserId, d.title.trim(), 'changed', r.id))
          return { ...r, status: asRequested ? ('declined' as const) : ('cancelled' as const), auto: true, updatedAt: now() }
        })
        const others = s.users.filter((u) => u.id !== old.ownerId).map((u) => u.id)
        set({
          books,
          requests,
          notifications: withMatchNotifs(s.users, books, s.wishlist, [...closeNotifs, ...s.notifications], others),
        })
        return null
      },

      removeBook: (id) =>
        set((s) => {
          const book = s.books.find((b) => b.id === id)
          if (!book) return s
          if (book.ownerId !== s.currentUserId && !isAdminNow(s)) return s
          const byAdmin = s.currentUserId !== book.ownerId
          const active = s.requests.filter(
            (r) => (r.bookId === id || r.offeredBookId === id) && (r.status === 'pending' || r.status === 'accepted'),
          )
          const activeIds = new Set(active.map((r) => r.id))
          const free = new Set<string>()
          for (const r of active) if (r.status === 'accepted') { free.add(r.bookId); if (r.offeredBookId) free.add(r.offeredBookId) }

          const mkNotif = (userId: string, extra: Partial<Notif>): Notif => ({
            id: uid(), userId, type: 'book_removed', bookTitle: book.title, read: false, createdAt: now(), ...extra,
          })
          const added: Notif[] = []
          // 1) люди, чий запит більше неможливо виконати
          for (const uidTo of new Set(active.map((r) => (r.bookId === id ? r.fromUserId : r.toUserId)))) {
            if (uidTo !== book.ownerId) added.push(mkNotif(uidTo, {}))
          }
          // 2) бажане: прибираємо запис, якщо ніхто інший цієї книги не пропонує
          const books = s.books.filter((b) => b.id !== id).map((b) => (free.has(b.id) ? { ...b, status: 'mine' as const } : b))
          const dropWish = (w: WishItem) =>
            w.userId !== book.ownerId && isMatch(w, book) && !books.some((b) => b.ownerId !== w.userId && isMatch(w, b))
          const droppedWishes = s.wishlist.filter(dropWish)
          for (const uidTo of new Set(droppedWishes.map((w) => w.userId))) added.push(mkNotif(uidTo, { wishRemoved: true }))
          // 3) власник, якщо книгу видалив адміністратор
          if (byAdmin) added.push(mkNotif(book.ownerId, { byAdmin: true }))

          return applyFreed(s, {
            books,
            requests: s.requests.filter((r) => !activeIds.has(r.id)),
            wishlist: s.wishlist.filter((w) => !dropWish(w)),
            notifications: [
              ...added,
              ...s.notifications.filter((n) => !(n.type === 'match' && n.bookId === id) && !(n.requestId && activeIds.has(n.requestId))),
            ],
          })
        }),

      reorderBooks: (ids) =>
        set((s) => ({
          books: s.books.map((b) => {
            const i = ids.indexOf(b.id)
            return i === -1 ? b : { ...b, order: i }
          }),
        })),

      addWish: ({ title, author, isbn, coverUrl, year }) => {
        const s = get()
        const me = s.currentUserId!
        const w: WishItem = {
          id: uid(),
          userId: me,
          title: title.trim(),
          author: author.trim(),
          isbn: isbn.trim(),
          coverUrl,
          year,
          createdAt: now(),
        }
        if (s.wishlist.some((x) => x.userId === me && x.title.trim().toLowerCase() === w.title.toLowerCase() && x.author.trim().toLowerCase() === w.author.toLowerCase()))
          return 'Ця книга вже є у вашому списку бажаного'
        const wishlist = [w, ...s.wishlist]
        set({ wishlist, notifications: withMatchNotifs(s.users, s.books, wishlist, s.notifications, [me]) })
        return null
      },

      removeWish: (id) => set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),

      sendRequest: ({ type, bookId, offeredBookId, returnDate, message }) => {
        const s = get()
        const me = s.currentUserId!
        const book = s.books.find((b) => b.id === bookId)
        if (!book) return 'Книгу не знайдено'
        if (book.ownerId === me) return 'Не можна просити власну книгу'
        if (book.status !== 'mine') return 'Ця книга зараз недоступна'
        if ((type === 'loan' && !book.loan) || (type === 'exchange' && !book.exchange))
          return type === 'loan' ? 'Цю книгу не дають у позику' : 'Цю книгу не міняють'
        if (type === 'exchange') {
          const off = s.books.find((b) => b.id === offeredBookId)
          if (!off || off.ownerId !== me || off.status !== 'mine' || !off.exchange) return 'Запропонована книга недоступна для обміну'
        }
        if (book.hidden || s.users.find((u) => u.id === book.ownerId)?.blocked) return 'Ця книга зараз недоступна'
        if (s.requests.some((r) => r.fromUserId === me && r.bookId === bookId && r.status === 'pending'))
          return 'Ви вже надіслали запит на цю книгу'
        const req: BookRequest = {
          id: uid(),
          type,
          bookId,
          fromUserId: me,
          toUserId: book.ownerId,
          offeredBookId,
          returnDate,
          message: message.trim(),
          status: 'pending',
          createdAt: now(),
          updatedAt: now(),
        }
        // про новий запит власник дізнається завжди: від цього залежить угода
        const notifications = [{ id: uid(), userId: book.ownerId, type: 'request_received' as const, requestId: req.id, read: false, createdAt: now() }, ...s.notifications]
        set({ requests: [req, ...s.requests], notifications })
        return null
      },

      respondRequest: (id, accept, newOfferedBookId) => {
        const s = get()
        const r0 = s.requests.find((x) => x.id === id)
        if (!r0 || r0.status !== 'pending') return null
        if (r0.toUserId !== s.currentUserId) return 'Відповісти може лише власник книги'
        let r = r0
        if (accept && newOfferedBookId && newOfferedBookId !== r0.offeredBookId) {
          const nb = s.books.find((b) => b.id === newOfferedBookId)
          if (r0.type !== 'exchange' || !nb || nb.ownerId !== r0.fromUserId || nb.status !== 'mine' || !nb.exchange || nb.hidden)
            return 'Цю книгу не можна обрати для обміну'
          r = { ...r0, offeredBookId: newOfferedBookId, counter: true }
        }
        const reserved = new Set(accept ? [r.bookId, ...(r.offeredBookId ? [r.offeredBookId] : [])] : [])
        if (accept) {
          // умови угоди мають і далі виконуватись
          const okBook = (b: Book | undefined, ownerId: string) => !!b && b.ownerId === ownerId && !b.hidden && !s.users.find((u) => u.id === ownerId)?.blocked
          const reqBook = s.books.find((b) => b.id === r.bookId)
          const offBook = r.offeredBookId ? s.books.find((b) => b.id === r.offeredBookId) : undefined
          const requester = s.users.find((u) => u.id === r.fromUserId)
          const flagsOk = !!reqBook && (r.type === 'loan' ? reqBook.loan : reqBook.exchange)
          const offerOk = r.type !== 'exchange' || (okBook(offBook, r.fromUserId) && !!offBook?.exchange)
          if (!requester || requester.blocked || !okBook(reqBook, r.toUserId) || !flagsOk || !offerOk)
            return 'Цей запит більше неможливо підтвердити: книга прихована, недоступна або змінила умови'
          // обидві книги угоди мають бути вільними
          const busy = [...reserved].some((bid) => s.books.find((b) => b.id === bid)?.status !== 'mine')
          if (busy) return 'Ця книга вже недоступна — її заброньовано або передано іншому читачу'
        }
        // решта очікуваних запитів, що чіпають заброньовані книги, відхиляються автоматично
        const clash = s.requests.filter(
          (x) => x.id !== id && x.status === 'pending' && (reserved.has(x.bookId) || (x.offeredBookId && reserved.has(x.offeredBookId))),
        )
        const clashIds = new Set(clash.map((x) => x.id))
        const clashNotifs: Notif[] = clash.map((x) => ({
          id: uid(), userId: x.fromUserId, type: 'request_unavailable' as const, requestId: x.id, read: false, createdAt: now(),
        }))
        const notifications: Notif[] = [
          ...clashNotifs,
          {
            id: uid(),
            userId: r.fromUserId,
            type: accept ? 'request_accepted' : 'request_declined',
            requestId: r.id,
            read: false,
            createdAt: now(),
          },
          ...s.notifications,
        ]
        set({
          requests: s.requests.map((x) =>
            x.id === id
              ? { ...r, status: accept ? 'accepted' : 'declined', updatedAt: now() }
              : clashIds.has(x.id)
                ? { ...x, status: 'declined' as const, auto: true, updatedAt: now() }
                : x,
          ),
          books: s.books.map((b) => (reserved.has(b.id) ? { ...b, status: 'reserved' } : b)),
          notifications,
        })
        return null
      },

      cancelRequest: (id) =>
        set((s) => {
          const r = s.requests.find((x) => x.id === id)
          if (!r || r.status !== 'pending' || r.fromUserId !== s.currentUserId) return s
          return {
            requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'cancelled' as const, updatedAt: now() } : x)),
            // сповіщення про сам запит більше не актуальне
            notifications: [
              { id: uid(), userId: r.toUserId, type: 'request_withdrawn' as const, requestId: r.id, read: false, createdAt: now() },
              ...s.notifications.filter((n) => !(n.type === 'request_received' && n.requestId === id)),
            ],
          }
        }),

      markLent: (id) =>
        set((s) => {
          const r = s.requests.find((x) => x.id === id)
          if (!r || r.status !== 'accepted' || r.type !== 'loan' || r.toUserId !== s.currentUserId) return s
          if (s.books.find((b) => b.id === r.bookId)?.status !== 'reserved') return s
          return {
            books: s.books.map((b) => (b.id === r.bookId ? { ...b, status: 'lent' as const } : b)),
            notifications: [{ id: uid(), userId: r.fromUserId, type: 'request_lent' as const, requestId: r.id, read: false, createdAt: now() }, ...s.notifications],
          }
        }),

      completeRequest: (id) =>
        set((s) => {
          const r = s.requests.find((x) => x.id === id)
          if (!r || r.status !== 'accepted' || r.toUserId !== s.currentUserId) return s
          const ids = new Set([r.bookId, ...(r.offeredBookId ? [r.offeredBookId] : [])])
          return applyFreed(s, {
            requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'completed', updatedAt: now() } : x)),
            books: s.books.map((b) => (ids.has(b.id) ? { ...b, status: 'mine' } : b)),
            notifications: [{ id: uid(), userId: r.fromUserId, type: 'request_completed' as const, requestId: r.id, read: false, createdAt: now() }, ...s.notifications],
          })
        }),

      addReview: (requestId, rating, comment) => {
        const s = get()
        const me = s.currentUserId
        const r = s.requests.find((x) => x.id === requestId)
        if (!me || !r || r.status !== 'completed') return 'Відгук можна залишити лише після завершення угоди'
        if (r.fromUserId !== me && r.toUserId !== me) return 'Ви не берете участі в цій угоді'
        const otherId = r.fromUserId === me ? r.toUserId : r.fromUserId
        if (!s.users.some((u) => u.id === otherId)) return 'Цього користувача більше немає на платформі'
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Оберіть оцінку від 1 до 5'
        const existing = s.reviews.find((v) => v.requestId === requestId && v.fromUserId === me)
        if (existing) {
          // свій відгук можна змінити
          set({ reviews: s.reviews.map((v) => (v.id === existing.id ? { ...v, rating, comment: comment.trim().slice(0, 500), updatedAt: now() } : v)) })
          return null
        }
        const review: Review = {
          id: uid(), requestId, fromUserId: me, toUserId: r.fromUserId === me ? r.toUserId : r.fromUserId,
          rating, comment: comment.trim().slice(0, 500), createdAt: now(),
        }
        set({
          reviews: [review, ...s.reviews],
          notifications: [{ id: uid(), userId: review.toUserId, type: 'review_received', reviewId: review.id, requestId, read: false, createdAt: now() }, ...s.notifications],
        })
        return null
      },

      deleteReview: (id) =>
        set((s) => {
          const v = s.reviews.find((x) => x.id === id)
          if (!v || (v.fromUserId !== s.currentUserId && !isAdminNow(s))) return s
          return { reviews: s.reviews.filter((x) => x.id !== id), notifications: s.notifications.filter((n) => n.reviewId !== id) }
        }),

      markRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)),
        })),

      adminSetBlocked: (userId, blocked) => {
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        if (userId === s.currentUserId) return 'Не можна заблокувати власний акаунт'
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        const users = s.users.map((x) => (x.id === userId ? { ...x, blocked } : x))
        if (!blocked) {
          set(applyFreed(s, { users }))
          return null
        }
        // блокування закриває всі активні запити користувача
        const closing = closeRequestsOf(s, userId, 'blocked', true)
        set(applyFreed(s, {
          users,
          requests: s.requests.map((r) =>
            closing.ids.has(r.id)
              ? { ...r, status: (r.status === 'pending' && r.toUserId === userId ? 'declined' : 'cancelled') as BookRequest['status'], auto: true, updatedAt: now() }
              : r,
          ),
          books: s.books.map((b) => (closing.free.has(b.id) ? { ...b, status: 'mine' as const } : b)),
          notifications: [...closing.notifs, ...s.notifications],
        }))
        return null
      },

      adminDeleteUser: (userId) => {
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        if (userId === s.currentUserId) return 'Не можна видалити власний акаунт тут'
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        if (u.role === 'admin' && adminCount(s.users) <= 1) return 'Не можна видалити останнього адміністратора'
        set(applyFreed(s, purgeUser(s, userId)))
        return null
      },

      adminSetRole: (userId, role) => {
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        if (role === 'user' && u.role === 'admin' && adminCount(s.users) <= 1)
          return 'Має лишитися хоча б один адміністратор'
        if (role === 'admin' && u.blocked) return 'Спершу розблокуйте користувача'
        set({ users: s.users.map((x) => (x.id === userId ? { ...x, role } : x)) })
        return null
      },

      adminToggleHidden: (bookId) =>
        set((s) => !isAdminNow(s) ? s : applyFreed(s, { books: s.books.map((b) => (b.id === bookId ? { ...b, hidden: !b.hidden } : b)) })),

      adminCancelRequest: (id) => {
        const s = get()
        const r = s.requests.find((x) => x.id === id)
        if (!isAdminNow(s) || !r || (r.status !== 'pending' && r.status !== 'accepted')) return
        const free = new Set(r.status === 'accepted' ? [r.bookId, ...(r.offeredBookId ? [r.offeredBookId] : [])] : [])
        const notify = (userId: string): Notif => ({
          id: uid(), userId, type: 'request_cancelled', requestId: r.id, read: false, createdAt: now(),
        })
        set(applyFreed(s, {
          requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'cancelled', updatedAt: now() } : x)),
          books: s.books.map((b) => (free.has(b.id) ? { ...b, status: 'mine' } : b)),
          notifications: [notify(r.fromUserId), notify(r.toUserId), ...s.notifications],
        }))
      },

      addGenre: (name) => {
        const n = name.trim()
        if (!n) return 'Вкажіть назву жанру'
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        if (s.genres.some((g) => g.toLowerCase() === n.toLowerCase())) return 'Такий жанр уже є'
        set({ genres: [...s.genres, n] })
        return null
      },

      renameGenre: (oldName, newName) => {
        const n = newName.trim()
        if (!n) return 'Вкажіть назву жанру'
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        if (n !== oldName && s.genres.some((g) => g.toLowerCase() === n.toLowerCase())) return 'Такий жанр уже є'
        const swap = (list: string[]) => [...new Set(list.map((g) => (g === oldName ? n : g)))]
        set({
          genres: s.genres.map((g) => (g === oldName ? n : g)),
          books: s.books.map((b) => (b.genres.includes(oldName) ? { ...b, genres: swap(b.genres) } : b)),
          users: s.users.map((u) => (u.genres.includes(oldName) ? { ...u, genres: swap(u.genres) } : u)),
        })
        return null
      },

      deleteGenre: (name) => {
        const s = get()
        if (!isAdminNow(s)) return NO_RIGHTS
        const used = s.books.filter((b) => b.genres.includes(name)).length
        if (used > 0) return `Жанр використовують книги (${used}). Спершу перейменуйте його або змініть жанр у книгах`
        set({
          genres: s.genres.filter((g) => g !== name),
          users: s.users.map((u) => (u.genres.includes(name) ? { ...u, genres: u.genres.filter((g) => g !== name) } : u)),
        })
        return null
      },
    }),
    {
      name: STORAGE_KEY,
      version: 5,
      storage: createJSONStorage(() => safeStorage),
      // хто увійшов — не зберігаємо в спільному сховищі
      partialize: (s) => {
        const { currentUserId: _omit, ...rest } = s
        void _omit
        return rest as State
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<State>), currentUserId: current.currentUserId }),
      migrate: (persisted, version) => {
        const st = persisted as Partial<State>
        if (version < 2) {
          const users = (st.users ?? []).map((u) => ({ ...u, role: (u as User).role ?? 'user' }))
          if (!users.some((u) => u.role === 'admin')) users.push(...seedUsers.filter((u) => u.role === 'admin'))
          st.users = users
          st.genres = st.genres ?? DEFAULT_GENRES
        }
        if (version < 3) {
          const reqs = st.requests ?? []
          st.requests = [...reqs, ...seedRequests.filter((r) => ['r5', 'r6', 'r7', 'r8'].includes(r.id) && !reqs.some((x) => x.id === r.id))]
          st.users = (st.users ?? []).map((u) => ({ ...u, createdAt: u.createdAt ?? seedUsers.find((x) => x.id === u.id)?.createdAt }))
        }
        if (version < 4) st.reviews = st.reviews ?? seedReviews
        if (version < 5) {
          // книги, заброньовані без підтвердженого запиту, повертаємо в доступні
          const held = new Set<string>()
          for (const r of st.requests ?? []) if (r.status === 'accepted') { held.add(r.bookId); if (r.offeredBookId) held.add(r.offeredBookId) }
          st.books = (st.books ?? []).map((b) => (b.status !== 'mine' && !held.has(b.id) ? { ...b, status: 'mine' as const } : b))
        }
        return st as State
      },
    },
  ),
)

// Невеликий незбережуваний стор для сповіщень-тостів
interface ToastState {
  message: string | null
  show: (m: string) => void
}
export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    set({ message })
    setTimeout(() => set((s) => (s.message === message ? { message: null } : s)), 2800)
  },
}))

export { isMatch }

// Запам'ятовуємо користувача вкладки та підтягуємо зміни, зроблені в іншій вкладці
if (typeof window !== 'undefined') {
  useStore.subscribe((s, prev) => {
    if (s.currentUserId === prev.currentUserId) return
    try {
      if (s.currentUserId) sessionStorage.setItem(SESSION_KEY, s.currentUserId)
      else sessionStorage.removeItem(SESSION_KEY)
    } catch { /* ignore */ }
  })
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) void useStore.persist.rehydrate()
  })
}
