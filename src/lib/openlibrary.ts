export interface OLBook {
  key: string
  title: string
  author: string
  year?: number
  coverUrl?: string
  isbn: string
}

interface OLDoc {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
}

/** Перетворює відповідь search.json на список книг (чиста функція, її легко тестувати). */
export function parseSearch(json: { docs?: OLDoc[] }): OLBook[] {
  const seen = new Set<string>()
  const out: OLBook[] = []
  for (const d of json.docs ?? []) {
    if (!d.title) continue
    const author = d.author_name?.[0] ?? ''
    const dedupe = `${d.title.toLowerCase()}|${author.toLowerCase()}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push({
      key: d.key ?? dedupe,
      title: d.title,
      author,
      year: d.first_publish_year,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      isbn: d.isbn?.[0] ?? '',
    })
  }
  return out
}

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,isbn'

/** Пошук за назвою, автором або ISBN. Кидає помилку, якщо немає мережі чи сервер недоступний. */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<OLBook[]> {
  const q = query.trim()
  const digits = q.replace(/[^0-9xX]/g, '')
  const isIsbn = /^[0-9xX\-\s]+$/.test(q) && (digits.length === 10 || digits.length === 13)
  const param = isIsbn ? `isbn=${encodeURIComponent(digits)}` : `q=${encodeURIComponent(q)}`
  const res = await fetch(`https://openlibrary.org/search.json?${param}&fields=${FIELDS}&limit=12`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return parseSearch(await res.json())
}
