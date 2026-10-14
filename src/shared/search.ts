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
  | { kind: 'match'; test: (text: string) => boolean; find: Finder }

// Where a term occurs in a (lower-cased) text, for highlighting: [from, to) offsets.
export type MatchRange = [number, number]
type Finder = (text: string) => MatchRange[]

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
    const n = text.length
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
    // (s < n: indexOf('') never runs out, it finds the end of the text again and again.)
    for (let s = text.indexOf(parts[0]); s >= 0; s = s < n ? text.indexOf(parts[0], s + 1) : -1) {
      if (s > 0 && WORD_CHAR.test(text[s - 1])) continue // not a word start
      if (rest(1, s + parts[0].length)) return true
    }
    return false
  }
}

// Every place a word occurs (see wordMatcher). A wildcard match takes in as much as its
// stars can cover, so "swim*" marks all of "swimming", not just "swim".
function wordFinder(word: string): Finder {
  const lower = word.toLowerCase()
  if (!lower.includes('*')) {
    return (text) => {
      const found: MatchRange[] = []
      for (let s = text.indexOf(lower); s >= 0; s = text.indexOf(lower, s + 1))
        found.push([s, s + lower.length])
      return found
    }
  }
  const parts = lower.split('*')
  return (text) => {
    // end[i][p]: the furthest the match can reach when parts i.. are matched with the
    // star before part i starting at p, or -1. Filled from the back, so each (part,
    // position) is worked out once, as in wordMatcher.
    const first = text.indexOf(parts[0])
    if (first < 0) return []
    const n = text.length
    const end: Int32Array[] = []
    end[parts.length] = Int32Array.from({ length: n + 1 }, (_, p) => p)
    for (let i = parts.length - 1; i >= 1; i--) {
      const row = new Int32Array(n + 1)
      for (let p = n; p >= 0; p--) {
        const here = text.startsWith(parts[i], p) ? end[i + 1][p + parts[i].length] : -1
        const later = p < n && WILD_CHAR.test(text[p]) ? row[p + 1] : -1
        row[p] = Math.max(here, later)
      }
      end[i] = row
    }
    const found: MatchRange[] = []
    for (let s = first; s >= 0; s = s < n ? text.indexOf(parts[0], s + 1) : -1) {
      if (s > 0 && WORD_CHAR.test(text[s - 1])) continue // not a word start
      const e = end[1][s + parts[0].length]
      if (e > s) found.push([s, e])
    }
    return found
  }
}

function phraseFinder(phrase: string): Finder {
  const words = phrase.toLowerCase().trim().split(/\s+/).map(escapeRe)
  const re = new RegExp(words.join('[^\\S\\n]+'), 'gu')
  return (text) =>
    Array.from(text.matchAll(re), (m): MatchRange => [m.index, m.index + m[0].length])
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
    if (t.type === 'phrase')
      return { kind: 'match', test: phraseMatcher(t.value), find: phraseFinder(t.value) }
    if (t.type === 'word')
      return { kind: 'match', test: wordMatcher(t.value), find: wordFinder(t.value) }
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

// The terms a matching text must contain: those under an even number of NOTs.
function positiveFinders(node: Node, negated = false): Finder[] {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.items.flatMap((n) => positiveFinders(n, negated))
    case 'not':
      return positiveFinders(node.item, !negated)
    case 'match':
      return negated ? [] : [node.find]
  }
}

export type Highlighter = (text: string) => MatchRange[]

// Compiles a query for highlighting (spec §7): the returned function gives where its
// terms occur in a text, sorted, with overlapping ranges merged. NOT terms are never
// marked, and AND/OR aren't traced per occurrence. Null for an empty query.
export function compileHighlighter(query: string): Highlighter | null {
  const tree = parse(tokenize(query))
  const finders = tree ? positiveFinders(tree) : []
  if (finders.length === 0) return null
  return (text) => {
    const { lower, start, end } = lowerCased(text)
    const found = finders.flatMap((f) => f(lower))
    return mergeRanges(start ? found.map(([a, b]) => [start[a], end![b]]) : found)
  }
}

// The text lower-cased, as the search sees it. A few characters get longer (e.g. "İ"
// becomes "i̇"); then start/end map each position in `lower` back to the text: start[k] is
// where the character holding lower[k] starts, end[k] where the one holding lower[k-1] ends.
function lowerCased(text: string): { lower: string; start?: number[]; end?: number[] } {
  const lower = text.toLowerCase()
  if (lower.length === text.length) return { lower }
  let built = ''
  const start: number[] = []
  const end: number[] = [0]
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!)
    const low = ch.toLowerCase()
    for (let k = 0; k < low.length; k++) {
      start.push(i)
      end.push(i + ch.length)
    }
    built += low
    i += ch.length
  }
  start.push(text.length)
  return { lower: built, start, end }
}

// Sorted, with overlapping or touching ranges joined into one.
export function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const merged: MatchRange[] = []
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}

// Several cells searched as one text: a line break between them, so a phrase can't
// run from one cell into the next but words can come from different cells.
export const joinCells = (cells: string[]): string => cells.join('\n')
