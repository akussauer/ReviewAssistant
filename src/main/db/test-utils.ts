import { listColumns } from './columns'
import { openReviewDb } from './open'
import type { DB } from './types'

// A brand-new review in memory: migrated, seeded with the template and one row.
export const freshReview = (): DB => openReviewDb(':memory:', { create: true })

export const columnId = (db: DB, label: string): number => {
  const c = listColumns(db).find((c) => c.label === label)
  if (!c) throw new Error(`no column ${label}`)
  return c.id
}
