import { getDb } from '../db/connection'
import { updateArticle } from '../db/articles'
import { IPC, type Article, type Column } from '../../shared/ipc'
import { NoInput, UpdateArticleInput } from '../../shared/schemas'
import { handle } from './handle'

type ColumnRow = {
  id: number
  key: string
  label: string
  widget_type: string
  options: string
  width: number
  position: number
}

export function registerIpc(): void {
  handle(IPC.articlesUpdate, UpdateArticleInput, ({ id, patch }): Article => {
    return updateArticle(id, patch)
  })

  handle(IPC.columnsList, NoInput, (): Column[] => {
    const rows = getDb()
      .prepare(
        'SELECT id, key, label, widget_type, options, width, position FROM columns ORDER BY position'
      )
      .all() as ColumnRow[]
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      widgetType: r.widget_type,
      options: JSON.parse(r.options),
      width: r.width,
      position: r.position
    }))
  })

  handle(IPC.articlesList, NoInput, (): Article[] => {
    const rows = getDb().prepare('SELECT id, data FROM articles ORDER BY position, id').all() as {
      id: number
      data: string
    }[]
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))
  })
}
