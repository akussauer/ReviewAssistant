// Literature-style search queries (PubMed-like), used by the global search box and the
// text-column filters:
//
//   pacing swimming        both words (AND is implied between terms)
//   "race pacing"          the exact phrase
//   pacing OR tactics      either; operators only count in CAPITALS ("or" is just a word)
//   pacing NOT juniors     the first without the second
//   (elite OR junior) AND pacing    brackets group
//   swim*                  words starting with "swim" (swim, swims, swimming…)
//
// Matching is case-insensitive. A plain word matches anywhere in the text, as in the
// PySide app ("swim" also finds "swimming"). Malformed queries never throw: a missing ")"
// or a dangling operator is simply ignored.

type Node =
  | { kind: 'and' | 'or'; items: Node[] }
  | { kind: 'not'; item: Node }
  | { kind: 'match'; test: (text: string) => boolean }

type Token = { type: 'word' | 'phrase' | 'and' | 'or' | 'not' | '(' | ')'; value: string }

export function tokenize(query: string): Token[] {
  const tokens: Token[] = []
  const re = /\s*(?:(\()|(\))|"([^"]*)"?|([^\s()"]+))/gy
  let m: RegExpExecArray | null
  while ((m = re.exec(query)) && m[0] !== '') {
    if (m[1]) tokens.push({ type: '(', value: '(' })
    else if (m[2]) tokens.push({ type: ')', value: ')' })
    else if (m[3] !== undefined) {
      if (m[3].trim()) tokens.push({ type: 'phrase', value: m[3] })
    } else if (m[4] === 'AND') tokens.push({ type: 'and', value: m[4] })
    else if (m[4] === 'OR') tokens.push({ type: 'or', value: m[4] })
    else if (m[4] === 'NOT') tokens.push({ type: 'not', value: m[4] })
    else tokens.push({ type: 'word', value: m[4] })
  }
  return tokens
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// What * can stand for, and what can't come just before a word start.
const WILD_CHAR = /[\p{L}\p{N}_-]/u
const WORD_CHAR = /[\p{L}\p{N}_]/u

function wordMatcher(word: string): (text: string) => boolean {
  const lower = word.toLowerCase()
  if (!lower.includes('*')) return (text) => text.includes(lower)
  // Truncation/wildcard: * stands for any letters; the match starts at a word start.
  // Not a regex: one like /a[\p{L}]*a[\p{L}]*a…/ can backtrack for minutes on a long
  // word, and queries also come from Claude Desktop (spec §10.1), running in main.
  const parts = lower.split('*')
  return (text) => {
    // dead[i][p] = 1: parts i.. can't match from position p. That doesn't depend on where
    // the match started, and a scan from p covers every later start in the same run of
    // letters, so it stops at a dead position. Each (part, position) is scanned once.
    const dead: (Uint8Array | undefined)[] = []
    const rest = (i: number, pos: number): boolean => {
      if (i === parts.length) return true
      const d = (dead[i] ??= new Uint8Array(text.length + 1))
      // The * before part i covers text[pos..p), which must be all wildcard characters.
      let p = pos
      for (; p <= text.length; p++) {
        if (d[p]) break
        if (text.startsWith(parts[i], p) && rest(i + 1, p + parts[i].length)) return true
        if (p === text.length || !WILD_CHAR.test(text[p])) {
          p++
          break
        }
      }
      d.fill(1, pos, p)
      return false
    }
    for (let s = text.indexOf(parts[0]); s >= 0; s = text.indexOf(parts[0], s + 1)) {
      if (s > 0 && WORD_CHAR.test(text[s - 1])) continue // not a word start
      if (rest(1, s + parts[0].length)) return true
    }
    return false
  }
}

function phraseMatcher(phrase: string): (text: string) => boolean {
  // Any run of spaces/tabs in the phrase matches any run in the text (but not a line break
  // between cells, see joinCells).
  const words = phrase.toLowerCase().trim().split(/\s+/).map(escapeRe)
  const re = new RegExp(words.join('[^\\S\\n]+'), 'u')
  return (text) => re.test(text)
}

// Recursive-descent parser:  or := and (OR and)* ;  and := not ((AND)? not)* ;
// not := NOT not | primary ;  primary := ( or ) | phrase | word
function parse(tokens: Token[]): Node | null {
  let i = 0
  const peek = (): Token | undefined => tokens[i]

  function parseOr(): Node | null {
    const items: Node[] = []
    for (;;) {
      const n = parseAnd()
      if (n) items.push(n)
      if (peek()?.type === 'or') i++
      else break
    }
    return items.length === 0 ? null : items.length === 1 ? items[0] : { kind: 'or', items }
  }

  function parseAnd(): Node | null {
    const items: Node[] = []
    for (;;) {
      const t = peek()
      if (!t || t.type === 'or' || t.type === ')') break
      if (t.type === 'and') {
        i++
        continue
      }
      const n = parseNot()
      if (n) items.push(n)
    }
    return items.length === 0 ? null : items.length === 1 ? items[0] : { kind: 'and', items }
  }

  function parseNot(): Node | null {
    const t = peek()
    if (t?.type === 'not') {
      i++
      const item = parseNot()
      return item ? { kind: 'not', item } : null
    }
    return parsePrimary()
  }

  function parsePrimary(): Node | null {
    const t = tokens[i++]
    if (!t) return null
    if (t.type === '(') {
      const inner = parseOr()
      if (peek()?.type === ')') i++
      return inner
    }
    if (t.type === 'phrase') return { kind: 'match', test: phraseMatcher(t.value) }
    if (t.type === 'word') return { kind: 'match', test: wordMatcher(t.value) }
    return null // a stray ")" or operator
  }

  // A stray ")" at top level would stop parseOr early; skip it and carry on.
  const parts: Node[] = []
  while (i < tokens.length) {
    const n = parseOr()
    if (n) parts.push(n)
    if (peek()?.type === ')') i++
  }
  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : { kind: 'and', items: parts }
}

function evaluate(node: Node, text: string): boolean {
  switch (node.kind) {
    case 'and':
      return node.items.every((n) => evaluate(n, text))
    case 'or':
      return node.items.some((n) => evaluate(n, text))
    case 'not':
      return !evaluate(node.item, text)
    case 'match':
      return node.test(text)
  }
}

export type Matcher = (text: string) => boolean

// Compiles a query once; the returned function tests a text (case-insensitively).
// An empty query matches everything.
export function compileQuery(query: string): Matcher {
  const tree = parse(tokenize(query))
  if (!tree) return () => true
  return (text) => evaluate(tree, text.toLowerCase())
}

// Several cells searched as one text: a line break between them, so a phrase can't
// run from one cell into the next but words can come from different cells.
export const joinCells = (cells: string[]): string => cells.join('\n')
