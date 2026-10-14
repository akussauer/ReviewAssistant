// The types behind t() (plan M10d). Everything is worked out from en.ts, the source of
// truth, so TypeScript knows every key and the {placeholders} each one needs.

// A count-dependent message: Intl.PluralRules picks the form, e.g. 1 -> one, 5 -> other.
// (French also uses "one" for 0.) The count is passed as {count}.
export type Plural = { one: string; other: string }

export type Catalog = { readonly [key: string]: string | Plural | Catalog }

const isPluralShape = (v: unknown): v is Plural =>
  typeof v === 'object' && v !== null && 'one' in v && 'other' in v
export const isPlural = isPluralShape

// The shape another language must have: en's keys, with any text as the values.
export type Messages<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Plural
      ? Plural
      : Messages<T[K]>
}

// "menu.file.open" etc.: the dotted path to every message.
export type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Keys<T[K], `${P}${K}.`>
}[keyof T & string]

// The message at a dotted path.
export type At<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? At<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never

// The {names} in a string, e.g. "Saved {n} of {total}" -> "n" | "total".
type Names<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Names<Rest> : never

// What t() needs for a message: plurals always need {count}.
export type ParamsOf<M> = M extends Plural
  ? Names<M['one']> | Names<M['other']> | 'count'
  : Names<M>

export type Value = string | number
