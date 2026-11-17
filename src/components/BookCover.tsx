import { cn } from '../lib/utils'

const PALETTE = ['#245C4F', '#7A4E2D', '#3B4F7A', '#7A3B4F', '#4F6B3B', '#5B3B7A', '#2F6B73', '#8A5A2B']

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface Props {
  title: string
  author?: string
  coverUrl?: string
  /** Співвідношення сторін, напр. "148/146" */
  ratio?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  xs: { title: 'text-[7px] leading-tight', author: 'hidden', pad: 'px-1.5 pb-1.5', spine: 'w-[3px]' },
  sm: { title: 'text-[11px] leading-tight', author: 'text-[8px]', pad: 'px-2.5 pb-2.5', spine: 'w-1' },
  md: { title: 'text-[15px] leading-tight', author: 'text-[10px]', pad: 'px-3.5 pb-3.5', spine: 'w-[9px]' },
  lg: { title: 'text-xl leading-tight', author: 'text-xs', pad: 'px-5 pb-5', spine: 'w-3.5' },
}

/** Згенерована книжкова обкладинка (або завантажене зображення). */
export function BookCover({ title, author, coverUrl, ratio = '148/146', size = 'md', className }: Props) {
  const s = sizes[size]
  const color = PALETTE[hash(title) % PALETTE.length]
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-md shadow-md', className)}
      style={{ aspectRatio: ratio, background: color }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <>
          <div className={cn('absolute inset-0 flex flex-col items-start justify-end text-white', s.pad)}>
            <span className={cn('font-bold', s.title)}>{title}</span>
            {author && <span className={cn('mt-1 opacity-80', s.author)}>{author}</span>}
          </div>
        </>
      )}
      <span className={cn('absolute inset-y-0 left-0 bg-black/25', s.spine)} />
    </div>
  )
}
