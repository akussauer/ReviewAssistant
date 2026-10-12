import { useEffect, useState } from 'react'
import type { Article, Column } from '../../shared/types'
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

  return <ArticleTable columns={columns} articles={articles} />
}

export default App