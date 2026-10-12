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

    insertArticle.run(JSON.stringify({ title: 'Example A', authors: 'Smith, J.', year: 2021 }), 0)
    insertArticle.run(JSON.stringify({ title: 'Example B', authors: 'Lee, K.', year: 2023 }), 1)
    insertArticle.run(JSON.stringify({ title: 'Example C', authors: 'Garcia, M.', year: 2019 }), 2)
  })()
}