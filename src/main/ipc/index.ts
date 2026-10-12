import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import type { Article, Column } from '../../shared/types'
import { UpdateArticleInput } from './schemas'
import { updateArticle } from '../db/articles'

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
  ipcMain.handle('ping', (_event, name: string) => {
    return `pong, ${name}! (from main, Node ${process.versions.node})`
  })

  ipcMain.handle('articles:update', (_event, raw: unknown): Article => {
  const { id, patch } = UpdateArticleInput.parse(raw)
  return updateArticle(id, patch)
  })

  ipcMain.handle('columns:list', (): Column[] => {
    const rows = getDb()
      .prepare('SELECT id, key, label, widget_type, options, width, position FROM columns ORDER BY position')
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

  ipcMain.handle('articles:list', (): Article[] => {
    const rows = getDb()
      .prepare('SELECT id, data FROM articles ORDER BY position, id')
      .all() as { id: number; data: string }[]
    return rows.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))
  })
}