import { MenuButton } from '../passthrough/weasel-ui';

/** One page in a project's set of labs. */
export interface LabPage {
  /** The page's own URL, and how the switcher knows which page is open. A
   *  relative one resolves against the open page, as its link does. A
   *  hash route (`#/dev/tools`) names a page on the current document. */
  href: string;
  label: string;
}

/** Props for `<LabSwitcher>`. */
export interface LabSwitcherProps {
  /** The open page's title, shown as the control's own label. */
  title: string;
  pages: readonly LabPage[];
  /** Defaults to the current location. Pass it in tests, or to render a
   *  switcher for a page other than the one being viewed. */
  path?: string;
  className?: string;
}

/** A URL split into the document it names and the hash route on it, each
 *  without its query, trailing slash or `.html`. */
function locate(url: string): { doc: string; route: string } {
  const hash = url.indexOf('#');
  const trim = (part: string) => part.replace(/\?.*$/, '').replace(/\/$/, '');
  return {
    doc: trim(hash < 0 ? url : url.slice(0, hash)).replace(/\.html$/, ''),
    route: hash < 0 ? '' : trim(url.slice(hash + 1)),
  };
}

/** Which of `pages` a path is on, or -1.
 *
 *  Matched on the end of the path so a query string, a trailing slash or a
 *  leftover `.html` cannot lose it: a project whose dev server maps `/stats`
 *  to `stats.html` serves both spellings, and a bookmark from before the URLs
 *  lost their extension still resolves to the same page.
 *
 *  A page whose `href` carries a hash is a route on a single document and wins
 *  when the path's hash is that route or one under it. A page without one
 *  ignores the hash, so an in-page anchor does not lose it. */
export function currentPage(path: string, pages: readonly LabPage[]): number {
  const base = new URL(
    path,
    typeof window === 'undefined' ? 'http://lab.invalid' : window.location.origin,
  );
  const here = locate(base.pathname + base.search + base.hash);
  // Each href resolves against the path as its link would, so `./effects` on
  // `/effects` names `/effects`. One on another origin names no page here.
  const target = (href: string) => {
    const to = new URL(href, base);
    return to.origin === base.origin ? locate(to.pathname + to.search + to.hash) : undefined;
  };
  const onDoc = (doc: string) => here.doc.endsWith(doc);
  const routed = pages.findIndex((p) => {
    if (!p.href.includes('#')) return false;
    const page = target(p.href);
    return (
      page !== undefined &&
      onDoc(page.doc) &&
      (here.route === page.route || here.route.startsWith(`${page.route}/`))
    );
  });
  if (routed >= 0) return routed;
  return pages.findIndex((p) => {
    if (p.href.includes('#')) return false;
    const page = target(p.href);
    return page !== undefined && onDoc(page.doc);
  });
}

/** A project's lab title, doubling as the way to reach its other labs.
 *
 *  The menu holds links, not a `<select>` and not buttons. These are separate
 *  documents, so an `href` is what gets middle-click, cmd-click and the back
 *  button for free; a select fires a change event and can do none of the
 *  three.
 *
 *  Pages accumulate -- a project grows a wall, a dashboard, an ingest page, a
 *  bench -- and a tab strip is the layout that stops working first. */
export function LabSwitcher({ title, pages, path, className }: LabSwitcherProps) {
  const here = currentPage(
    path ?? (typeof window === 'undefined' ? '' : window.location.pathname + window.location.hash),
    pages,
  );
  const titleClass = `lk-switcher-title${className ? ` ${className}` : ''}`;

  // One lab is not a set to choose from, and a disclosure arrow promising a
  // menu of itself is worse than no control.
  if (pages.length < 2) return <h1 className={titleClass}>{title}</h1>;

  // The open page stays in the list rather than being filtered out: a menu that
  // drops its current entry shifts every other one as you move between pages.
  return (
    <h1 className={titleClass}>
      <MenuButton
        bare
        label={title}
        items={pages.map((page, i) => ({
          value: page.href,
          label: page.label,
          href: page.href,
          isCurrent: i === here,
        }))}
      />
    </h1>
  );
}
