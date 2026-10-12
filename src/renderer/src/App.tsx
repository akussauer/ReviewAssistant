import { useEffect, useState } from 'react'
import type { Article, Column } from '../../shared/types'

function App(): React.JSX.Element {
  const [columns, setColumns] = useState<Column[]>([])
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    Promise.all([window.api.columns.list(), window.api.articles.list()]).then(([c, a]) => {
      setColumns(c)
      setArticles(a)
    })
  }, [])

  return (
    <table>
      <thead>
        <tr>{columns.map((c) => <th key={c.id}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {articles.map((a) => (
          <tr key={a.id}>
            {columns.map((c) => <td key={c.id}>{String(a.data[c.key] ?? '')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default App