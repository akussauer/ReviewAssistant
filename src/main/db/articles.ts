import { getDb } from './connection'
import type { Article, ArticlePatch } from '../../shared/types'

export function updateArticle(id: number, patch: ArticlePatch): Article {
  const db = getDb()

  const validKeys = new Set(
    (db.prepare('SELECT key FROM columns').all() as { key: string }[]).map((c) => c.key)
  )
  for (const key of Object.keys(patch)) {
    if (!validKeys.has(key)) throw new Error(`Unknown column: ${key}`)
  }

  const row = db.prepare('SELECT data FROM articles WHERE id = ?').get(id) as
    | { data: string }
    | undefined
  if (!row) throw new Error(`Article ${id} not found`)

  const data = { ...JSON.parse(row.data), ...patch }
  db.prepare('UPDATE articles SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    JSON.stringify(data),
    id
  )
  return { id, data }
}