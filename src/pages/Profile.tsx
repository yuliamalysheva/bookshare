import { useMemo, useState } from 'react'
import { Bell, LogOut, Moon, TriangleAlert } from 'lucide-react'
import { Button, Chip, PageHeader, StatCard, TextField, Toggle } from '../components/ui'
import { useStore, useToast } from '../store'
import { cn, findMatches, initials } from '../lib/utils'

export function Profile() {
  const me = useStore((s) => s.users.find((u) => u.id === s.currentUserId))!
  const books = useStore((s) => s.books)
  const GENRES = useStore((s) => s.genres)
  const wishlist = useStore((s) => s.wishlist)
  const requests = useStore((s) => s.requests)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const updateProfile = useStore((s) => s.updateProfile)
  const logout = useStore((s) => s.logout)
  const deleteAccount = useStore((s) => s.deleteAccount)
  const toast = useToast((s) => s.show)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState(me.email)
  const [city, setCity] = useState(me.city)
  const [error, setError] = useState('')
  const [editGenres, setEditGenres] = useState(false)
  const [editContacts, setEditContacts] = useState(false)
  const [tg, setTg] = useState(me.contacts?.telegram ?? '')
  const [phone, setPhone] = useState(me.contacts?.phone ?? '')
  const [shareEmail, setShareEmail] = useState(!!me.contacts?.shareEmail)
  const [cErr, setCErr] = useState('')

  const saveContacts = () => {
    const handle = tg.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
    if (handle && !/^[A-Za-z0-9_]{4,32}$/.test(handle)) return setCErr('Telegram: 4–32 символи, лише латиниця, цифри та _')
    const digits = phone.replace(/\D/g, '')
    if (phone.trim() && (digits.length < 9 || digits.length > 15)) return setCErr('Вкажіть коректний номер телефону')
    updateProfile({ contacts: { telegram: handle || undefined, phone: phone.trim() || undefined, shareEmail } })
    setTg(handle)
    setCErr('')
    setEditContacts(false)
    toast('Контакти збережено')
  }

  const stats = useMemo(
    () => ({
      books: books.filter((b) => b.ownerId === me.id).length,
      wishes: wishlist.filter((w) => w.userId === me.id).length,
      requests: requests.filter((r) => r.fromUserId === me.id || r.toUserId === me.id).length,
      matches: findMatches(wishlist, books, me.id).length,
    }),
    [books, wishlist, requests, me.id],
  )

  const save = () => {
    if (!name.trim()) return setError("Вкажіть ім'я")
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Введіть коректну пошту')
    const err = updateProfile({ name: name.trim(), email: email.trim(), city: city.trim() })
    if (err) return setError(err)
    setError('')
    setEditing(false)
    toast('Профіль оновлено')
  }

  const toggleGenre = (g: string) =>
    updateProfile({ genres: me.genres.includes(g) ? me.genres.filter((x) => x !== g) : [...me.genres, g] })

  const remove = () => {
    if (me.role === 'admin' && useStore.getState().users.filter((u) => u.role === 'admin' && !u.blocked).length <= 1)
      return toast('Ви єдиний адміністратор — спершу призначте іншого')
    if (window.confirm('Видалити акаунт разом з усіма вашими книгами та запитами? Цю дію неможливо скасувати.')) deleteAccount()
  }

  return (
    <>
      <PageHeader title="Мій профіль" subtitle="Особиста інформація та налаштування" />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="h-24 bg-gradient-to-r from-primary to-sage" />
        <div className="flex flex-wrap items-end gap-5 px-7 pb-6">
          <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-surface bg-sage text-4xl font-bold text-ink">
            {initials(me.name)}
          </div>
          <div className="pb-1">
            <div className="text-xl font-bold">{me.name}</div>
            <div className="text-sm text-muted">{me.city || 'Місто не вказано'} · {me.email}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <StatCard label="Книг" value={stats.books} desc="у бібліотеці" />
        <StatCard label="Бажане" value={stats.wishes} desc="у списку" />
        <StatCard label="Запитів" value={stats.requests} desc="усього" />
        <StatCard label="Збігів" value={stats.matches} desc="зараз доступно" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_417px]">
        <div className="grid gap-6">
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Особиста інформація</h2>
              {!editing ? (
                <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setEditing(true)}>Редагувати</button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={() => { setEditing(false); setName(me.name); setEmail(me.email); setCity(me.city); setError('') }}>Скасувати</Button>
                  <Button className="h-8 rounded-lg px-3 text-xs" onClick={save}>Зберегти</Button>
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField label="Ім'я та прізвище" value={name} onChange={(e) => setName(e.target.value)} disabled={!editing} />
              <TextField label="Електронна пошта" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing} />
              <TextField label="Місто" value={city} onChange={(e) => setCity(e.target.value)} disabled={!editing} />
              <TextField label="Мова інтерфейсу" value="Українська" disabled readOnly />
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Контакти для зв'язку</h2>
              {!editContacts ? (
                <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setEditContacts(true)}>Редагувати</button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={() => { setEditContacts(false); setTg(me.contacts?.telegram ?? ''); setPhone(me.contacts?.phone ?? ''); setShareEmail(!!me.contacts?.shareEmail); setCErr('') }}>Скасувати</Button>
                  <Button className="h-8 rounded-lg px-3 text-xs" onClick={saveContacts}>Зберегти</Button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">Інші читачі побачать їх лише після того, як запит між вами буде підтверджено.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="Telegram" optional placeholder="username" value={tg} onChange={(e) => setTg(e.target.value)} disabled={!editContacts} />
              <TextField label="Телефон" optional placeholder="+380 50 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editContacts} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Показувати електронну пошту</div>
                <div className="text-xs text-muted">{me.email}</div>
              </div>
              <Toggle checked={shareEmail} onChange={(v) => editContacts && setShareEmail(v)} label="Показувати електронну пошту" />
            </div>
            {cErr && <p className="mt-3 text-sm text-danger">{cErr}</p>}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Улюблені жанри</h2>
              <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setEditGenres(!editGenres)}>
                {editGenres ? 'Готово' : 'Змінити'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(editGenres ? GENRES : me.genres).map((g) => {
                const on = me.genres.includes(g)
                return editGenres ? (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={cn('rounded-full border px-4 py-1.5 text-sm transition', on ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-beige/50')}
                  >
                    {g}
                  </button>
                ) : (
                  <Chip key={g} tone="primary" className="px-4 py-1.5 text-sm">{g}</Chip>
                )
              })}
              {!editGenres && me.genres.length === 0 && <span className="text-sm text-muted">Жанри ще не обрані</span>}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="font-semibold">Налаштування</h2>
          <div className="mt-5 divide-y divide-line">
            <Row icon={<Bell size={18} />} title="Сповіщення" desc="Збіги та запити">
              <Toggle label="Сповіщення" checked={me.notifyOn} onChange={(v) => updateProfile({ notifyOn: v })} />
            </Row>
            <Row icon={<Moon size={18} />} title="Темна тема" desc="Вигляд інтерфейсу">
              <Toggle label="Темна тема" checked={theme === 'dark'} onChange={toggleTheme} />
            </Row>
            <Row icon={<LogOut size={18} />} title="Вийти" desc="Завершити сеанс">
              <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={logout}>Вийти</Button>
            </Row>
          </div>
        </section>
      </div>

      <section className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/15 text-danger"><TriangleAlert size={20} /></span>
        <div className="min-w-[200px] flex-1">
          <div className="font-semibold">Видалення акаунта</div>
          <div className="text-xs text-muted">Усі ваші книги, бажане та запити буде видалено безповоротно.</div>
        </div>
        <Button variant="danger" onClick={remove}>Видалити</Button>
      </section>
    </>
  )
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/40 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      {children}
    </div>
  )
}
