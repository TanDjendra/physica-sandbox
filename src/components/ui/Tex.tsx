/** Thin KaTeX wrapper. Rendering is memoised per expression string. */

import { useMemo } from 'react'
import katex from 'katex'

export function Tex({
  children,
  display = false,
  className = '',
}: {
  children: string
  display?: boolean
  className?: string
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        output: 'html',
        trust: false,
      })
    } catch {
      return `<code>${children}</code>`
    }
  }, [children, display])

  return display ? (
    <div className={`tex-card overflow-x-auto ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={`tex-card ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  )
}
