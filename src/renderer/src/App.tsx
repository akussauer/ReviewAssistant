import { useCallback, useEffect, useState } from 'react'
import type { Article, Column } from '../../shared/ipc'
import { ArticleTable } from './components/ArticleTable/ArticleTable'

function App(): React.JSX.Element {
  const [columns, setColumns] = useState<Column[]>([])
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    Promise.all([window.api.columns.list(), window.api.articles.list()]).then(([c, a]) => {
      setColumns(c)
      setArticles(a)
    })
  }, [])

  const handleUpdate = useCallback(
    async (id: number, key: string, value: string | number | null) => {
      try {
        const updated = await window.api.articles.update(id, { [key]: value })
        setArticles((prev) => prev.map((a) => (a.id === id ? updated : a)))
      } catch (err) {
        console.error('Update failed', err)
      }
    },
    []
  )

  return <ArticleTable columns={columns} articles={articles} onUpdate={handleUpdate} />
}

export default App
