import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Catalog } from './pages/Catalog'
import { Library } from './pages/Library'
import { Wishlist } from './pages/Wishlist'
import { Matches } from './pages/Matches'
import { Requests } from './pages/Requests'
import { Profile } from './pages/Profile'
import { Admin } from './pages/Admin'
import { UserProfile } from './pages/UserProfile'

function AdminGuard({ children }: { children: ReactNode }) {
  const isAdmin = useStore((s) => s.users.find((u) => u.id === s.currentUserId)?.role === 'admin')
  return isAdmin ? <>{children}</> : <Navigate to="/catalog" replace />
}

function Protected() {
  const me = useStore((s) => s.currentUserId)
  const exists = useStore((s) => s.users.some((u) => u.id === s.currentUserId && !u.blocked))
  const logout = useStore((s) => s.logout)
  // акаунт заблокували або видалили, поки користувач був у системі
  useEffect(() => {
    if (me && !exists) logout()
  }, [me, exists, logout])
  if (!me || !exists) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  const theme = useStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/library" element={<Library />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </HashRouter>
  )
}
