/**
 * A saved file's pages: one `<wd:page id name width height>` element each, in page order, on the
 * root. A file without them is one page, of its `wd:paperSize` if it declares one.
 */
import type { Page } from '@weasel-js/core';
import type { NamespacedElement, ParseResult } from '@weasel-js/svg';

/** The `wd:page` elements that list `pages`. */
export function pageElements(pages: readonly Page[]): NamespacedElement[] {
  return pages.map((p) => ({
    attrs: { id: p.id, ...(p.name !== undefined ? { name: p.name } : {}), width: String(p.width), height: String(p.height) },
  }));
}

/** The pages a parsed file lists, or `undefined` when it lists none, or one it cannot read. */
export function pagesOfParsed(parsed: ParseResult): Page[] | undefined {
  const elements = parsed.documentMeta?.wd?.elements?.page;
  if (!elements?.length) return undefined;
  const seen = new Set<string>();
  const pages: Page[] = [];
  for (const { attrs } of elements) {
    const width = Number(attrs.width);
    const height = Number(attrs.height);
    const id = attrs.id;
    if (!id || seen.has(id) || !(width > 0) || !(height > 0)) return undefined;
    seen.add(id);
    pages.push({ id, ...(attrs.name !== undefined ? { name: attrs.name } : {}), width, height });
  }
  return pages;
}
