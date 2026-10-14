import { describe, expect, it } from 'vitest'
import { MAIN_TAB_ID } from '../../shared/ipc'
import { addMessage, clearMessages, listMessages } from './messages'
import { createTab, deleteTab } from './tabs'
import { freshReview } from './test-utils'

describe('messages', () => {
  it('keeps each tab’s conversation in order, with costs', () => {
    const db = freshReview()
    const tab = createTab(db, { label: 'Pacing', type: 'review' })
    addMessage(db, tab.id, { role: 'user', content: 'Summarise', context: ['This tab (3 rows)'] })
    addMessage(db, tab.id, {
      role: 'assistant',
      content: 'Done',
      model: 'a/b',
      tokensIn: 120,
      tokensOut: 30,
      cost: 0.0004,
      costEstimated: true
    })
    addMessage(db, MAIN_TAB_ID, { role: 'user', content: 'Other tab' })

    const messages = listMessages(db, tab.id)
    expect(messages.map((m) => [m.role, m.content, m.context])).toEqual([
      ['user', 'Summarise', ['This tab (3 rows)']],
      ['assistant', 'Done', []]
    ])
    expect(messages[1]).toMatchObject({
      model: 'a/b',
      tokensIn: 120,
      tokensOut: 30,
      cost: 0.0004,
      costEstimated: true
    })
    expect(messages[0]).toMatchObject({ model: null, cost: null, costEstimated: false })

    clearMessages(db, tab.id)
    expect(listMessages(db, tab.id)).toEqual([])
    expect(listMessages(db, MAIN_TAB_ID)).toHaveLength(1)
  })

  it('go with their tab, and need one', () => {
    const db = freshReview()
    const tab = createTab(db, { label: 'Pacing', type: 'review' })
    addMessage(db, tab.id, { role: 'user', content: 'hi' })
    deleteTab(db, tab.id)
    expect(db.prepare('SELECT COUNT(*) FROM messages').pluck().get()).toBe(0)
    expect(() => addMessage(db, tab.id, { role: 'user', content: 'hi' })).toThrow(/not found/)
  })
})
