import { Fragment } from 'react'

// Puts elements into translated text, where the translation has the placeholder:
//   rich(t('tabs.deleteBody', { name: '{name}' }), { name: <i>Pacing</i> })
// (t() is given the placeholder itself, so it stays in the text for rich() to fill.)
export function rich(text: string, parts: Record<string, React.ReactNode>): React.ReactNode {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1]
    return <Fragment key={i}>{name !== undefined && name in parts ? parts[name] : piece}</Fragment>
  })
}
