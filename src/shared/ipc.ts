// The single source of truth for the renderer <-> main boundary.
// Channel names live here so main (ipcMain.handle) and preload (ipcRenderer.invoke)
// can't drift apart, and `Api` describes exactly what the renderer sees as `window.api`.

export const IPC = {
  columnsList: 'columns:list',
  articlesList: 'articles:list',
  articlesUpdate: 'articles:update'
} as const

export type Column = {
  id: number
  key: string
  label: string
  widgetType: string
  options: Record<string, unknown>
  width: number
  position: number
}

export type CellValue = string | number | null

export type Article = {
  id: number
  data: Record<string, unknown> // values keyed by column.key (M2 switches to column id)
}

export type ArticlePatch = Record<string, CellValue>

export type Api = {
  columns: { list(): Promise<Column[]> }
  articles: {
    list(): Promise<Article[]>
    update(id: number, patch: ArticlePatch): Promise<Article>
  }
}
