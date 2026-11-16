import { Star } from 'lucide-react'
import { cn } from '../lib/utils'

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warn" aria-label={`Оцінка ${value} з 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} className={i <= Math.round(value) ? '' : 'text-line'} />
      ))}
    </span>
  )
}

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Оцінка">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} з 5`}
          onClick={() => onChange(i)}
          className={cn('rounded-lg p-1 transition hover:scale-110', i <= value ? 'text-warn' : 'text-line hover:text-warn/60')}
        >
          <Star size={30} fill={i <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}
