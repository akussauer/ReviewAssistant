import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// A reply rendered as markdown (spec §10), with GitHub extras (tables, task lists,
// strikethrough). react-markdown builds React elements and ignores raw HTML, so text the
// model copied from a file can't inject markup. Links open in the browser; images are
// shown as their description, never fetched (they could be used to leak data).
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" title={href}>
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="text-muted-foreground">[image{alt ? `: ${alt}` : ''}]</span>
}

export const Markdown = memo(function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
