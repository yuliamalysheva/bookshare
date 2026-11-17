import { Component } from 'react'
import type { ReactNode } from 'react'
import { resetDemoData } from '../store'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-bold">Щось пішло не так</h1>
          <p className="mt-2 text-sm text-muted">Сталася непередбачена помилка. Спробуйте перезавантажити сторінку; якщо не допомагає — скиньте демо-дані.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button className="h-10 rounded-xl border border-line px-5 text-sm font-semibold hover:bg-beige/60" onClick={() => location.reload()}>Перезавантажити</button>
            <button className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg hover:opacity-90" onClick={resetDemoData}>Скинути демо-дані</button>
          </div>
        </div>
      </div>
    )
  }
}
