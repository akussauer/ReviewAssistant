export type Column = {
  id: number
  key: string
  label: string
  widgetType: string
  options: Record<string, unknown>
  width: number
  position: number
}

export type Article = {
  id: number
  data: Record<string, unknown> // values keyed by column.key
}

export type Api = {
  ping(name: string): Promise<string>
  columns: { list(): Promise<Column[]> }
  articles: { list(): Promise<Article[]> }
}