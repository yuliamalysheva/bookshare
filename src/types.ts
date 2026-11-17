export type BookStatus = 'mine' | 'reserved' | 'lent'

export const STATUS_LABEL: Record<BookStatus, string> = {
  mine: 'У мене',
  reserved: 'Заброньовано',
  lent: 'У позиці',
}

export const AVAILABILITY_LABEL: Record<BookStatus, string> = {
  mine: 'Доступна',
  reserved: 'Заброньована',
  lent: 'У позиці',
}

export const DEFAULT_GENRES = [
  'Фантастика',
  'Фентезі',
  'Пригоди',
  'Класика',
  'Антиутопія',
  'Сучасна проза',
  'Детектив',
  'Романтика',
  'Історія',
  'Науково-популярна',
]

export type Role = 'user' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  password: string
  city: string
  genres: string[]
  notifyOn: boolean
  role: Role
  blocked?: boolean
  createdAt?: string
  contacts?: Contacts
}

/** Контакти видно лише тому, з ким підтверджено запит. */
export interface Contacts {
  telegram?: string
  phone?: string
  shareEmail?: boolean
}

export interface Book {
  id: string
  ownerId: string
  title: string
  author: string
  isbn: string
  genres: string[]
  description: string
  coverUrl?: string
  status: BookStatus
  loan: boolean
  exchange: boolean
  order: number
  hidden?: boolean
  createdAt: string
}

export interface WishItem {
  id: string
  userId: string
  title: string
  author: string
  isbn: string
  coverUrl?: string
  year?: number
  createdAt: string
}

export type RequestType = 'loan' | 'exchange'
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Очікує',
  accepted: 'Підтверджено',
  declined: 'Відхилено',
  cancelled: 'Скасовано',
  completed: 'Завершено',
}

export interface BookRequest {
  id: string
  type: RequestType
  bookId: string
  fromUserId: string
  toUserId: string
  offeredBookId?: string
  /** власник обрав іншу книгу замість запропонованої */
  counter?: boolean
  /** запит закрила система, а не людина */
  auto?: boolean
  returnDate?: string
  message: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
}

export type NotifType = 'match' | 'request_received' | 'request_accepted' | 'request_declined' | 'request_cancelled' | 'request_unavailable' | 'book_removed' | 'review_received' | 'request_closed' | 'request_withdrawn' | 'request_lent' | 'request_completed'

export interface Notif {
  id: string
  userId: string
  type: NotifType
  bookId?: string
  requestId?: string
  key?: string
  /** книга знову стала доступною */
  back?: boolean
  bookTitle?: string
  /** чому запит закрито системою */
  reason?: 'blocked' | 'deleted' | 'changed'
  /** книгу видалив адміністратор */
  byAdmin?: boolean
  /** книгу прибрано зі списку бажаного */
  wishRemoved?: boolean
  reviewId?: string
  read: boolean
  createdAt: string
}

/** Необов'язковий відгук після завершеної угоди. */
export interface Review {
  id: string
  requestId: string
  fromUserId: string
  toUserId: string
  rating: number
  comment: string
  createdAt: string
  updatedAt?: string
}
