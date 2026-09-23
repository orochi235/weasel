import { useCallback, useEffect, useId, useRef, useState } from 'react';

/** One page in a project's set of labs. */
export interface LabPage {
  /** The page's own URL, and how the switcher knows which page is open. A
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
  const here = locate(path);
  const onDoc = (doc: string) => here.doc.endsWith(doc);
  const routed = pages.findIndex((p) => {
    if (!p.href.includes('#')) return false;
    const page = locate(p.href);
    return (
      onDoc(page.doc) && (here.route === page.route || here.route.startsWith(`${page.route}/`))
    );
  });
  if (routed >= 0) return routed;
  return pages.findIndex((p) => !p.href.includes('#') && onDoc(locate(p.href).doc));
}

/** A project's lab title, doubling as the way to reach its other labs.
 *
 *  The menu holds real anchors, not a `<select>` and not buttons. These are
 *  separate documents, so an `href` is what gets middle-click, cmd-click and
 *  the back button for free; a select fires a change event and can do none of
 *  the three. The trigger is a button because it opens something rather than
 *  going anywhere.
 *
 *  Pages accumulate -- a project grows a wall, a dashboard, an ingest page, a
 *  bench -- and a tab strip is the layout that stops working first. */
export function LabSwitcher({ title, pages, path, className }: LabSwitcherProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const here = currentPage(
    path ?? (typeof window === 'undefined' ? '' : window.location.pathname + window.location.hash),
    pages,
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        root.current?.querySelector('button')?.focus();
      }
    };
    // Pointer, not click: a press that starts outside should dismiss before
    // whatever it lands on reacts, the way every other menu on the page does.
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  // One lab is not a set to choose from, and a disclosure arrow promising a
  // menu of itself is worse than no control.
  if (pages.length < 2) {
    return <h1 className={`lk-switcher-title${className ? ` ${className}` : ''}`}>{title}</h1>;
  }

  return (
    <div className={`lk-switcher${className ? ` ${className}` : ''}`} ref={root}>
      <h1 className="lk-switcher-title">
        <button
          type="button"
          className="lk-switcher-trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((was) => !was)}
        >
          {title}
          <span className="lk-switcher-caret" aria-hidden="true" />
        </button>
      </h1>
      {open && (
        <div className="lk-switcher-menu" id={menuId} role="menu">
          {pages.map((page, i) => (
            <a
              key={page.href}
              href={page.href}
              role="menuitem"
              className="lk-switcher-item"
              aria-current={i === here ? 'page' : undefined}
              onClick={close}
            >
              {page.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
