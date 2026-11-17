import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, TextField } from '../components/ui'
import { Logo } from '../components/Layout'
import { resetDemoData, useStore, useToast } from '../store'

export function Login() {
  const me = useStore((s) => s.users.some((u) => u.id === s.currentUserId && !u.blocked))
  const login = useStore((s) => s.login)
  const register = useStore((s) => s.register)
  const toast = useToast((s) => s.show)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')

  if (me) return <Navigate to="/catalog" replace />

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Введіть коректну електронну пошту')
    if (mode === 'register') {
      if (password.length < 6) return setError('Пароль має містити щонайменше 6 символів')
      if (!name.trim()) return setError("Вкажіть ім'я")
      if (!city.trim()) return setError('Вкажіть місто')
      if (password !== password2) return setError('Паролі не збігаються')
      const err = register({ name, email, password, city })
      if (err) setError(err)
    } else {
      if (!password) return setError('Введіть пароль')
      const err = login(email, password)
      if (err) setError(err)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo size={44} />
      </div>
      <form onSubmit={submit} className="w-full max-w-[500px] rounded-3xl border border-line bg-surface p-8 shadow-card sm:p-10">
        <div className="mb-7 grid grid-cols-2 rounded-xl bg-beige/50 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className={`h-10 rounded-lg text-sm font-semibold transition ${mode === m ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink'}`}
            >
              {m === 'login' ? 'Вхід' : 'Реєстрація'}
            </button>
          ))}
        </div>
        <h1 className="text-3xl font-bold">{mode === 'login' ? 'Вітаємо!' : 'Створити акаунт'}</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === 'login' ? 'Увійдіть, щоб продовжити' : 'Приєднуйтесь до спільноти читачів вашого міста'}
        </p>

        <div className="mt-7 grid gap-4">
          {mode === 'register' && (
            <>
              <TextField label="Ім'я та прізвище" required value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Місто" required value={city} onChange={(e) => setCity(e.target.value)} />
            </>
          )}
          <TextField label="Електронна пошта" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          {mode === 'register' && (
            <TextField label="Повторіть пароль" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••" hint="Щонайменше 6 символів" />
          )}
        </div>

        {mode === 'login' && (
          <div className="mt-3 text-right">
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => toast('Відновлення пароля буде доступне пізніше')}>
              Забули пароль?
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <Button type="submit" className="mt-6 h-[52px] w-full">
          {mode === 'login' ? 'Увійти' : 'Зареєструватися'}
        </Button>

        <div className="relative my-6 text-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
          <span className="relative bg-surface px-4 text-sm text-muted">
            {mode === 'login' ? 'Ще не маєте акаунта?' : 'Вже є акаунт?'}{' '}
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? 'Зареєструватися' : 'Увійти'}
            </button>
          </span>
        </div>

        {mode === 'login' && (
          <>
          <button
            type="button"
            onClick={() => { setEmail('maria@email.com'); setPassword('123456') }}
            className="w-full rounded-xl bg-beige/50 px-4 py-3 text-xs text-muted hover:bg-beige"
          >
            Демо-акаунт: maria@email.com / 123456 — натисніть, щоб підставити
          </button>
          <button
            type="button"
            onClick={() => { if (window.confirm('Скинути всі демо-дані до початкових? Створені вами акаунти й книги буде видалено.')) resetDemoData() }}
            className="mt-3 w-full text-center text-xs text-muted hover:text-danger hover:underline"
          >
            Скинути демо-дані
          </button>
          </>
        )}
      </form>
    </div>
  )
}
