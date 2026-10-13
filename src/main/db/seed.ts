import { getDb } from './connection'

export function seedIfEmpty(): void {
  const db = getDb()
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM articles').get() as { n: number }
  if (n > 0) return

  const insertColumn = db.prepare(
    'INSERT INTO columns (key, label, widget_type, position) VALUES (?, ?, ?, ?)'
  )
  const insertArticle = db.prepare('INSERT INTO articles (data, position) VALUES (?, ?)')

  db.transaction(() => {
    insertColumn.run('title', 'Title', 'text', 0)
    insertColumn.run('authors', 'Author(s)', 'text', 1)
    insertColumn.run('year', 'Publish Date', 'number', 2)

    for (let i = 0; i < 100; i++) {
      insertArticle.run(
        JSON.stringify({
          title: `Example ${i + 1}`,
          authors: ['Smith, J.', 'Lee, K.', 'Garcia, M.'][i % 3],
          year: 1990 + ((i * 7) % 35)
        }),
        i
      )
    }
  })()
}
