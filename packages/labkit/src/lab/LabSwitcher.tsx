import { MenuButton } from '@weasel-js/ui/components/MenuButton';

/** One page in a project's set of labs. */
export interface LabPage {
  /** The page's own URL, and how the switcher knows which page is open. A
   *  relative one resolves against the open page, as its link does. A
   *  hash route (`#/dev/tools`) names a page on the current document. The
   *  link drops a trailing `.html` (see `labRoutes` in `@weasel-js/labkit/vite`). */
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
 *  without its query, trailing slash or `.html`; a directory's `index.html`
 *  names the directory. */
function locate(url: string): { doc: string; route: string } {
  const hash = url.indexOf('#');
  const trim = (part: string) => part.replace(/\?.*$/, '').replace(/\/$/, '');
  return {
    doc: trim(hash < 0 ? url : url.slice(0, hash))
      .replace(/\.html$/, '')
      .replace(/\/index$/, ''),
    route: hash < 0 ? '' : trim(url.slice(hash + 1)),
  };
}

/** The URL a page's link opens: `href` with a trailing `.html` dropped, and a
 *  directory's `index.html` dropped whole (`fastmoney.html` → `fastmoney`,
 *  `index.html` → `./`). Its query and hash are kept. An href naming another
 *  origin or scheme is left as given, since its server may not answer the
 *  shorter spelling. */
export function extensionlessHref(href: string): string {
  if (/^([a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? '' : href.slice(cut);
  if (!path.endsWith('.html')) return href;
  const dir = /(^|\/)index\.html$/.test(path);
  const clean = dir ? path.slice(0, -'index.html'.length) : path.slice(0, -'.html'.length);
  return (clean === '' ? './' : clean) + rest;
}

/** Which of `pages` a path is on, or -1.
 *
 *  Matched on the end of the path so a query string, a trailing slash or a
 *  leftover `.html` cannot lose it: a project whose dev server maps `/stats`
 *  to `stats.html` serves both spellings, and a bookmark from before the URLs
 *  lost their extension still resolves to the same page.
 *
 *  Where several pages match, the longest match is the one marked.
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
  // Every other doc starts with `/`, so its suffix match ends on a segment; the root's is empty and would match all.
  const onDoc = (doc: string) => (doc === '' ? here.doc === '' : here.doc.endsWith(doc));
  // The longest match wins, so `/sub/stats` is not taken for `/stats` nor `#/dev/tools` for `#/dev`; ties go to the first.
  const best = (score: (page: { doc: string; route: string }, href: string) => number | null) => {
    let at = -1;
    let top = -1;
    pages.forEach((p, i) => {
      const page = target(p.href);
      const s = page === undefined ? null : score(page, p.href);
      if (s !== null && s > top) [at, top] = [i, s];
    });
    return at;
  };
  const routed = best((page, href) =>
    href.includes('#') &&
    onDoc(page.doc) &&
    (here.route === page.route || here.route.startsWith(`${page.route}/`))
      ? page.route.length * 1e4 + page.doc.length
      : null,
  );
  if (routed >= 0) return routed;
  return best((page, href) => (!href.includes('#') && onDoc(page.doc) ? page.doc.length : null));
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
          href: extensionlessHref(page.href),
          current: i === here,
        }))}
      />
    </h1>
  );
}
