import type { Book, BookRequest, Notif, Review, User, WishItem } from '../types'

const day = 86400000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const inDays = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 10)

export const ME = 'u-maria'

export const seedUsers: User[] = [
  { id: ME, name: 'Марія Коваленко', email: 'maria@email.com', password: '123456', city: 'Харків', genres: ['Фантастика', 'Сучасна проза', 'Класика', 'Антиутопія'], notifyOn: true, role: 'user', createdAt: ago(200 * day) },
  { id: 'u-oleh', name: 'Олег Шевченко', email: 'oleh@email.com', password: '123456', city: 'Харків', genres: ['Антиутопія'], notifyOn: true, role: 'user', createdAt: ago(200 * day) },
  { id: 'u-anna', name: 'Анна Мельник', email: 'anna@email.com', password: '123456', city: 'Харків', genres: ['Романтика'], notifyOn: true, role: 'user', createdAt: ago(200 * day) },
  { id: 'u-ihor', name: 'Ігор Бондар', email: 'ihor@email.com', password: '123456', city: 'Харків', genres: ['Фентезі'], notifyOn: true, role: 'user', createdAt: ago(200 * day) },
  { id: 'u-admin', name: 'Адміністратор', email: 'admin@email.com', password: 'admin123', city: 'Харків', genres: [], notifyOn: false, role: 'admin', createdAt: ago(300 * day) },
  { id: 'u-sofia', name: 'Софія Лисенко', email: 'sofia@email.com', password: '123456', city: 'Харків', genres: ['Класика'], notifyOn: true, role: 'user', createdAt: ago(200 * day) },
]

type B = Omit<Book, 'createdAt' | 'description'> & { description?: string }
const mk = (b: B, i: number): Book => ({
  description: 'Короткий опис книги з тестових даних BookShare.',
  ...b,
  createdAt: ago((40 - i) * day),
})

const books: B[] = [
  // Бібліотека Марії
  { id: 'b-dune', ownerId: ME, title: 'Дюна', author: 'Френк Герберт', isbn: '9780441172719', genres: ['Фантастика', 'Пригоди'], status: 'mine', loan: true, exchange: true, order: 0, description: 'Епічна історія про пустельну планету Арракіс, політичні інтриги та боротьбу за спайс.' },
  { id: 'b-misto', ownerId: ME, title: 'Місто', author: "Валер'ян Підмогильний", isbn: '9786175850176', genres: ['Класика', 'Сучасна проза'], status: 'mine', loan: true, exchange: false, order: 1 },
  { id: 'b-martian', ownerId: ME, title: 'Марсіанин', author: 'Енді Вейр', isbn: '9780553418026', genres: ['Фантастика'], status: 'mine', loan: true, exchange: true, order: 2 },
  { id: 'b-lotr', ownerId: ME, title: 'Володар перснів', author: 'Дж. Р. Р. Толкін', isbn: '9780618640157', genres: ['Фентезі', 'Пригоди'], status: 'mine', loan: false, exchange: true, order: 3 },
  { id: 'b-100', ownerId: ME, title: 'Сто років самотності', author: 'Габріель Гарсія Маркес', isbn: '9780060883287', genres: ['Класика'], status: 'lent', loan: true, exchange: false, order: 4 },
  // Інші користувачі
  { id: 'b-1984', ownerId: 'u-oleh', title: '1984', author: 'Джордж Орвелл', isbn: '9780451524935', genres: ['Антиутопія'], status: 'mine', loan: false, exchange: true, order: 0 },
  { id: 'b-tyhrolovy', ownerId: 'u-oleh', title: 'Тигролови', author: 'Іван Багряний', isbn: '9786171200000', genres: ['Пригоди', 'Класика'], status: 'mine', loan: true, exchange: true, order: 1 },
  { id: 'b-prince', ownerId: 'u-anna', title: 'Маленький принц', author: 'Антуан де Сент-Екзюпері', isbn: '9780156012195', genres: ['Класика'], status: 'mine', loan: false, exchange: true, order: 0 },
  { id: 'b-pride', ownerId: 'u-anna', title: 'Гордість і упередження', author: 'Джейн Остін', isbn: '9780141439518', genres: ['Романтика', 'Класика'], status: 'mine', loan: true, exchange: true, order: 1 },
  { id: 'b-tini', ownerId: 'u-ihor', title: 'Тіні забутих предків', author: 'Михайло Коцюбинський', isbn: '9786171500000', genres: ['Класика'], status: 'reserved', loan: true, exchange: false, order: 0 },
  { id: 'b-witcher', ownerId: 'u-ihor', title: 'Відьмак', author: 'Анджей Сапковський', isbn: '9788375780635', genres: ['Фентезі'], status: 'mine', loan: true, exchange: true, order: 1 },
  { id: 'b-martian2', ownerId: 'u-sofia', title: 'Марсіанин', author: 'Енді Вейр', isbn: '9780553418026', genres: ['Фантастика'], status: 'lent', loan: true, exchange: false, order: 0 },
  { id: 'b-lotr2', ownerId: 'u-sofia', title: 'Володар перснів', author: 'Дж. Р. Р. Толкін', isbn: '9780618640157', genres: ['Фентезі'], status: 'mine', loan: false, exchange: true, order: 1 },
  { id: 'b-dune2', ownerId: 'u-sofia', title: 'Дюна', author: 'Френк Герберт', isbn: '9780441172719', genres: ['Фантастика', 'Пригоди'], status: 'mine', loan: true, exchange: true, order: 2 },
]

export const seedBooks: Book[] = books.map(mk)

export const seedWishlist: WishItem[] = [
  { id: 'w1', userId: ME, title: 'Маленький принц', author: 'Антуан де Сент-Екзюпері', isbn: '', createdAt: ago(5 * day) },
  { id: 'w2', userId: ME, title: '1984', author: 'Джордж Орвелл', isbn: '', createdAt: ago(4 * day) },
  { id: 'w3', userId: ME, title: 'Тигролови', author: 'Іван Багряний', isbn: '', createdAt: ago(3 * day) },
  { id: 'w4', userId: ME, title: 'Відьмак', author: 'Анджей Сапковський', isbn: '', createdAt: ago(2 * day) },
]

export const seedRequests: BookRequest[] = [
  { id: 'r1', type: 'loan', bookId: 'b-dune', fromUserId: 'u-oleh', toUserId: ME, returnDate: inDays(21), message: 'Привіт! Давно хотів прочитати Дюну, поверну вчасно.', status: 'pending', createdAt: ago(3 * 3600000), updatedAt: ago(3 * 3600000) },
  { id: 'r2', type: 'exchange', bookId: 'b-martian', fromUserId: 'u-anna', toUserId: ME, offeredBookId: 'b-pride', message: 'Пропоную обмін на Гордість і упередження.', status: 'pending', createdAt: ago(26 * 3600000), updatedAt: ago(26 * 3600000) },
  { id: 'r3', type: 'loan', bookId: 'b-tyhrolovy', fromUserId: ME, toUserId: 'u-oleh', returnDate: inDays(14), message: '', status: 'pending', createdAt: ago(day), updatedAt: ago(day) },
  { id: 'r4', type: 'loan', bookId: 'b-100', fromUserId: 'u-sofia', toUserId: ME, returnDate: inDays(10), message: 'Дякую!', status: 'accepted', createdAt: ago(6 * day), updatedAt: ago(5 * day) },
  // історія інших користувачів (для профілів довіри)
  { id: 'r5', type: 'loan', bookId: 'b-tyhrolovy', fromUserId: 'u-anna', toUserId: 'u-oleh', returnDate: inDays(-30), message: '', status: 'completed', createdAt: ago(60 * day), updatedAt: ago(40 * day) },
  { id: 'r6', type: 'exchange', bookId: 'b-witcher', fromUserId: 'u-sofia', toUserId: 'u-ihor', offeredBookId: 'b-lotr2', message: '', status: 'completed', createdAt: ago(50 * day), updatedAt: ago(45 * day) },
  { id: 'r7', type: 'loan', bookId: 'b-prince', fromUserId: 'u-ihor', toUserId: 'u-anna', returnDate: inDays(-20), message: '', status: 'completed', createdAt: ago(35 * day), updatedAt: ago(25 * day) },
  { id: 'r8', type: 'loan', bookId: 'b-1984', fromUserId: 'u-sofia', toUserId: 'u-oleh', returnDate: inDays(-10), message: '', status: 'declined', createdAt: ago(20 * day), updatedAt: ago(19 * day) },
]

export const seedReviews: Review[] = [
  { id: 'rv1', requestId: 'r5', fromUserId: 'u-anna', toUserId: 'u-oleh', rating: 5, comment: 'Олег швидко відповів, книга в чудовому стані.', createdAt: ago(39 * day) },
  { id: 'rv2', requestId: 'r5', fromUserId: 'u-oleh', toUserId: 'u-anna', rating: 5, comment: 'Повернула вчасно, дякую!', createdAt: ago(39 * day) },
  { id: 'rv3', requestId: 'r6', fromUserId: 'u-sofia', toUserId: 'u-ihor', rating: 4, comment: 'Обмін пройшов добре, трохи запізнився на зустріч.', createdAt: ago(44 * day) },
  { id: 'rv4', requestId: 'r7', fromUserId: 'u-ihor', toUserId: 'u-anna', rating: 5, comment: '', createdAt: ago(24 * day) },
]

export const seedNotifications: Notif[] = [
  { id: 'n1', userId: ME, type: 'match', bookId: 'b-prince', key: `match:${ME}:b-prince`, read: false, createdAt: ago(2 * 3600000) },
  { id: 'n2', userId: ME, type: 'match', bookId: 'b-1984', key: `match:${ME}:b-1984`, read: false, createdAt: ago(5 * 3600000) },
  { id: 'n3', userId: ME, type: 'request_received', requestId: 'r1', read: false, createdAt: ago(3 * 3600000) },
  { id: 'n4', userId: ME, type: 'request_received', requestId: 'r2', read: true, createdAt: ago(26 * 3600000) },
  { id: 'n5', userId: ME, type: 'match', bookId: 'b-tyhrolovy', key: `match:${ME}:b-tyhrolovy`, read: true, createdAt: ago(2 * day) },
  { id: 'n6', userId: ME, type: 'match', bookId: 'b-witcher', key: `match:${ME}:b-witcher`, read: true, createdAt: ago(2 * day) },
]
