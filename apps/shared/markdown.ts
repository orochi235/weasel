/**
 * Markdown as the site receives it: rendered where the site is built
 * (`scripts/lib/markdownBlocks.ts`), so the client carries no parser.
 */

/** A run of prose as HTML, or one fenced code block left as text for the page to highlight. */
export type MarkdownBlock =
  | { readonly kind: 'html'; readonly html: string }
  | { readonly kind: 'code'; readonly code: string; readonly language: string };
