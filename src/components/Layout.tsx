import { useMemo } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, BookMarked, Heart, Inbox, LibraryBig, Settings, Compass, ShieldCheck } from 'lucide-react'
import { useStore } from '../store'
import { cn, initials } from '../lib/utils'
import { Toast } from './ui'

function Logo({ size = 39 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-fg"
        style={{ width: size, height: size }}
      >
        b
      </div>
      <span className="text-xl font-bold">BookShare</span>
    </div>
  )
}
export { Logo }

export function Layout() {
  const me = useStore((s) => s.users.find((u) => u.id === s.currentUserId))
  const notifications = useStore((s) => s.notifications)
  const requests = useStore((s) => s.requests)

  const unread = useMemo(
    () => notifications.filter((n) => n.userId === me?.id && !n.read).length,
    [notifications, me],
  )
  const incoming = useMemo(
    () => requests.filter((r) => r.toUserId === me?.id && r.status === 'pending').length,
    [requests, me],
  )

  const items = [
    { to: '/catalog', label: 'Каталог', icon: Compass, badge: 0 },
    { to: '/library', label: 'Моя бібліотека', icon: LibraryBig, badge: 0 },
    { to: '/wishlist', label: 'Список бажаного', icon: Heart, badge: 0 },
    { to: '/matches', label: 'Збіги та сповіщення', icon: Bell, badge: unread },
    { to: '/requests', label: 'Мої запити', icon: Inbox, badge: incoming },
  ]

  if (me?.role === 'admin') items.push({ to: '/admin', label: 'Адмін-панель', icon: ShieldCheck, badge: 0 })

  return (
    <div className="min-h-screen">
      {/* Сайдбар (десктоп) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-line bg-surface lg:flex">
        <div className="px-[27px] pt-[27px]">
          <Logo />
        </div>
        <nav className="mt-[22px] flex flex-col gap-[5px] px-[11px]">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-[47px] items-center gap-3 rounded-xl px-[18px] text-sm font-medium transition',
                  isActive ? 'bg-primary text-primary-fg' : 'text-ink hover:bg-beige/60',
                )
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="flex h-[18px] min-w-[19px] items-center justify-center rounded-full bg-warn px-1 text-[11px] font-bold text-ink">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <NavLink to="/profile" className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-full bg-sage text-base font-bold text-ink">
                {initials(me?.name ?? '')}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{me?.name}</div>
                <div className="text-xs text-muted">Мій профіль</div>
              </div>
            </NavLink>
            <NavLink to="/profile" aria-label="Налаштування" className="text-muted hover:text-ink">
              <Settings size={17} />
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Верхня панель (мобільна) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo size={34} />
        <NavLink to="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-sage font-bold text-ink">
          {initials(me?.name ?? '')}
        </NavLink>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-8 lg:pb-10 lg:pl-[284px] lg:pr-[38px] lg:pt-[38px]">
        <div className="mx-auto max-w-[1113px]">
          <Outlet />
        </div>
      </main>

      {/* Нижня навігація (мобільна) */}
      <nav style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface lg:hidden">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', isActive ? 'text-primary' : 'text-muted')
            }
          >
            <Icon size={20} />
            <span className="max-w-full truncate px-1">{label.split(' ')[label.includes('Моя') ? 1 : 0]}</span>
            {badge > 0 && (
              <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-bold text-ink">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Toast />
    </div>
  )
}

export { BookMarked }
