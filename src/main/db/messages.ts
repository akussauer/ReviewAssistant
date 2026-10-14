import type { ChatMessage } from '../../shared/ipc'
import type { DB } from './types'

// Each tab's assistant conversation (spec §10), saved in the review file. Only the chat
// writes here: messages never touch rows or columns.

type MessageRecord = {
  id: number
  role: ChatMessage['role']
  content: string
  context: string
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  cost: number | null
  cost_estimated: number
  created_at: string
}

const toMessage = (r: MessageRecord): ChatMessage => ({
  id: r.id,
  role: r.role,
  content: r.content,
  context: JSON.parse(r.context),
  model: r.model,
  tokensIn: r.tokens_in,
  tokensOut: r.tokens_out,
  cost: r.cost,
  costEstimated: r.cost_estimated === 1,
  createdAt: r.created_at
})

// Oldest first.
export function listMessages(db: DB, tabId: number): ChatMessage[] {
  const rows = db
    .prepare('SELECT * FROM messages WHERE tab_id = ? ORDER BY id')
    .all(tabId) as MessageRecord[]
  return rows.map(toMessage)
}

export type NewMessage = Pick<ChatMessage, 'role' | 'content'> &
  Partial<
    Pick<ChatMessage, 'context' | 'model' | 'tokensIn' | 'tokensOut' | 'cost' | 'costEstimated'>
  >

export function addMessage(db: DB, tabId: number, m: NewMessage): ChatMessage {
  if (!db.prepare('SELECT 1 FROM tabs WHERE id = ?').get(tabId)) {
    throw new Error(`Tab ${tabId} not found`)
  }
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO messages (tab_id, role, content, context, model, tokens_in, tokens_out,
                             cost, cost_estimated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tabId,
      m.role,
      m.content,
      JSON.stringify(m.context ?? []),
      m.model ?? null,
      m.tokensIn ?? null,
      m.tokensOut ?? null,
      m.cost ?? null,
      m.costEstimated ? 1 : 0
    )
  return toMessage(
    db.prepare('SELECT * FROM messages WHERE id = ?').get(lastInsertRowid) as MessageRecord
  )
}

// New chat: removes the tab's conversation (and so its running cost).
export function clearMessages(db: DB, tabId: number): void {
  db.prepare('DELETE FROM messages WHERE tab_id = ?').run(tabId)
}
