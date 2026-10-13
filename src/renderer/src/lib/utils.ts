// shadcn's `cn` helper merges Tailwind class names. Newer shadcn components import it from
// the `cn` package directly; this re-export keeps components.json's "utils" alias valid for
// any component or template that still imports `@/lib/utils`.
export { cn } from 'cn'
