import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Book, BookRequest, Notif, RequestType, Review, Role, User, WishItem } from '../types'
import { DEFAULT_GENRES } from '../types'
import { seedBooks, seedNotifications, seedRequests, seedReviews, seedUsers, seedWishlist } from '../data/seed'
import { findMatches, isMatch, uid, visibleBooks } from '../lib/utils'

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

  addBook: (d: NewBook) => void
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

/** Прибирає користувача та все, що з ним пов'язано. */
function purgeUser(s: State, id: string): Partial<State> {
  const bookIds = new Set(s.books.filter((b) => b.ownerId === id).map((b) => b.id))
  const dropped = s.requests.filter((r) => r.fromUserId === id || r.toUserId === id || bookIds.has(r.bookId) || (r.offeredBookId && bookIds.has(r.offeredBookId)))
  const droppedIds = new Set(dropped.map((r) => r.id))
  // книги інших людей, заброньовані через видалені запити, знову стають доступними
  const free = new Set<string>()
  for (const r of dropped) {
    if (r.status !== 'accepted') continue
    free.add(r.bookId)
    if (r.offeredBookId) free.add(r.offeredBookId)
  }
  return {
    users: s.users.filter((u) => u.id !== id),
    books: s.books
      .filter((b) => b.ownerId !== id)
      .map((b) => (free.has(b.id) && b.status !== 'mine' ? { ...b, status: 'mine' as const } : b)),
    wishlist: s.wishlist.filter((w) => w.userId !== id),
    requests: s.requests.filter((r) => !droppedIds.has(r.id)),
    notifications: s.notifications.filter((n) => n.userId !== id && !(n.requestId && droppedIds.has(n.requestId))),
    reviews: s.reviews.filter((r) => r.fromUserId !== id && r.toUserId !== id && !droppedIds.has(r.requestId)),
  }
}

const adminCount = (users: User[]) => users.filter((u) => u.role === 'admin' && !u.blocked).length

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      users: seedUsers,
      currentUserId: null,
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
      },

      updateBook: (id, d) => {
        const s = get()
        const old = s.books.find((b) => b.id === id)
        const actor = s.users.find((u) => u.id === s.currentUserId)
        if (!old || (old.ownerId !== s.currentUserId && actor?.role !== 'admin')) return 'Книгу не знайдено'
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
        const others = s.users.filter((u) => u.id !== old.ownerId).map((u) => u.id)
        set({ books, notifications: withMatchNotifs(s.users, books, s.wishlist, s.notifications, others) })
        return null
      },

      removeBook: (id) =>
        set((s) => {
          const book = s.books.find((b) => b.id === id)
          if (!book) return s
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
        if (book.status !== 'mine') return 'Ця книга зараз недоступна'
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
        const owner = s.users.find((u) => u.id === book.ownerId)
        const notifications = owner?.notifyOn
          ? [{ id: uid(), userId: book.ownerId, type: 'request_received' as const, requestId: req.id, read: false, createdAt: now() }, ...s.notifications]
          : s.notifications
        set({ requests: [req, ...s.requests], notifications })
        return null
      },

      respondRequest: (id, accept, newOfferedBookId) => {
        const s = get()
        const r0 = s.requests.find((x) => x.id === id)
        if (!r0 || r0.status !== 'pending') return null
        let r = r0
        if (accept && newOfferedBookId && newOfferedBookId !== r0.offeredBookId) {
          const nb = s.books.find((b) => b.id === newOfferedBookId)
          if (r0.type !== 'exchange' || !nb || nb.ownerId !== r0.fromUserId || nb.status !== 'mine' || !nb.exchange || nb.hidden)
            return 'Цю книгу не можна обрати для обміну'
          r = { ...r0, offeredBookId: newOfferedBookId, counter: true }
        }
        const reserved = new Set(accept ? [r.bookId, ...(r.offeredBookId ? [r.offeredBookId] : [])] : [])
        if (accept) {
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
                ? { ...x, status: 'declined' as const, updatedAt: now() }
                : x,
          ),
          books: s.books.map((b) => (reserved.has(b.id) ? { ...b, status: 'reserved' } : b)),
          notifications,
        })
        return null
      },

      cancelRequest: (id) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id && r.status === 'pending' ? { ...r, status: 'cancelled', updatedAt: now() } : r,
          ),
        })),

      markLent: (id) =>
        set((s) => {
          const r = s.requests.find((x) => x.id === id)
          if (!r) return s
          return { books: s.books.map((b) => (b.id === r.bookId ? { ...b, status: 'lent' } : b)) }
        }),

      completeRequest: (id) =>
        set((s) => {
          const r = s.requests.find((x) => x.id === id)
          if (!r || r.status !== 'accepted') return s
          const ids = new Set([r.bookId, ...(r.offeredBookId ? [r.offeredBookId] : [])])
          return applyFreed(s, {
            requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'completed', updatedAt: now() } : x)),
            books: s.books.map((b) => (ids.has(b.id) ? { ...b, status: 'mine' } : b)),
          })
        }),

      addReview: (requestId, rating, comment) => {
        const s = get()
        const me = s.currentUserId
        const r = s.requests.find((x) => x.id === requestId)
        if (!me || !r || r.status !== 'completed') return 'Відгук можна залишити лише після завершення угоди'
        if (r.fromUserId !== me && r.toUserId !== me) return 'Ви не берете участі в цій угоді'
        if (s.reviews.some((v) => v.requestId === requestId && v.fromUserId === me)) return 'Ви вже залишили відгук'
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Оберіть оцінку від 1 до 5'
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

      markRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)),
        })),

      adminSetBlocked: (userId, blocked) => {
        const s = get()
        if (userId === s.currentUserId) return 'Не можна заблокувати власний акаунт'
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        set(applyFreed(s, { users: s.users.map((x) => (x.id === userId ? { ...x, blocked } : x)) }))
        return null
      },

      adminDeleteUser: (userId) => {
        const s = get()
        if (userId === s.currentUserId) return 'Не можна видалити власний акаунт тут'
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        if (u.role === 'admin' && adminCount(s.users) <= 1) return 'Не можна видалити останнього адміністратора'
        set(applyFreed(s, purgeUser(s, userId)))
        return null
      },

      adminSetRole: (userId, role) => {
        const s = get()
        const u = s.users.find((x) => x.id === userId)
        if (!u) return 'Користувача не знайдено'
        if (role === 'user' && u.role === 'admin' && adminCount(s.users) <= 1)
          return 'Має лишитися хоча б один адміністратор'
        if (role === 'admin' && u.blocked) return 'Спершу розблокуйте користувача'
        set({ users: s.users.map((x) => (x.id === userId ? { ...x, role } : x)) })
        return null
      },

      adminToggleHidden: (bookId) =>
        set((s) => applyFreed(s, { books: s.books.map((b) => (b.id === bookId ? { ...b, hidden: !b.hidden } : b)) })),

      adminCancelRequest: (id) => {
        const s = get()
        const r = s.requests.find((x) => x.id === id)
        if (!r || (r.status !== 'pending' && r.status !== 'accepted')) return
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
        if (s.genres.some((g) => g.toLowerCase() === n.toLowerCase())) return 'Такий жанр уже є'
        set({ genres: [...s.genres, n] })
        return null
      },

      renameGenre: (oldName, newName) => {
        const n = newName.trim()
        if (!n) return 'Вкажіть назву жанру'
        const s = get()
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
      name: 'bookshare:v1',
      version: 4,
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
