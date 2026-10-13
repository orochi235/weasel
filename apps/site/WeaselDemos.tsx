import { Suspense, lazy, useEffect, useRef, useState, type RefObject } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { CATEGORIES, DEMOS, DEMOS_BY_ID, PACKAGES, placeOf, type DemoEntry, type DemoSourceTab } from './registry';
import { sessionStore } from './chunkReload';
import { PageBoundary } from './PageBoundary';
import { TAGLINE } from './FrontPage/tagline';
import { VersionPill } from './FrontPage/VersionPill';
import { Wordmark } from './FrontPage/Wordmark';
import { DEMOS_ID, FRONT_ID, GET_STARTED_ID, RELEASES_ID, WHATS_NEW_ID, goFront, routeOf } from './routes';

// All three are lazy so the entry bundle carries only the nav: `Releases`
// pulls in `virtual:changelogs` (every published changelog entry), and
// `SourceView` pulls in `prism-react-renderer`. None is needed to show a demo.
const SourceView = lazy(() => import('./SourceView'));
const WhatsNew = lazy(() => import('./WhatsNew').then((m) => ({ default: m.WhatsNew })));
const Releases = lazy(() => import('./Releases').then((m) => ({ default: m.Releases })));
const GetStarted = lazy(() => import('./FrontPage/GetStarted').then((m) => ({ default: m.GetStarted })));

/** Format a git-ISO date as "3d ago" / "2w ago" / "Apr 2024" — close
 *  in time gets a relative phrasing; older falls back to a static
 *  month/year so the eyebrow doesn't fluctuate as the page sits. */
function formatRelativeOrIso(iso: string): string {
  const now = Date.now();
  const ms = now - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < day) return 'today';
  const days = Math.floor(ms / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
import { CommandPalette, InlineMarkdown } from '@weasel-js/ui';
import { useCommandPaletteShortcut } from './CommandPalette/useCommandPaletteShortcut';
import logoUrl from './assets/weasel-logo.svg';

function readHash(): string {
  if (window.location.hash === `#${DEMOS_ID}`) return DEMOS[0].id;
  return routeOf(window.location.hash, (id) => DEMOS_BY_ID.has(id));
}

export function WeaselDemos() {
  const [activeId, setActiveId] = useState<string>(() => readHash());
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);

  // A page opened from inside the app is a history entry of its own, so Back
  // returns to the one before it.
  const open = (id: string): void => {
    if (id !== activeId) window.history.pushState(null, '', `#${id}`);
    setActiveId(id);
  };

  useEffect(() => {
    const onHash = () => setActiveId(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    // A hash that named nothing: hand the page back to the front page.
    if (activeId === FRONT_ID) goFront();
    else if (window.location.hash.replace(/^#/, '') !== activeId) {
      window.history.replaceState(null, '', `#${activeId}`);
    }
  }, [activeId]);

  const active = DEMOS_BY_ID.get(activeId) ?? null;

  if (activeId === FRONT_ID) return null;

  return (
    <div className="ckd-app">
      <aside className="ckd-sidebar">
        <header className="ckd-sidebar-header">
          <img src={logoUrl} alt="weasel logo" className="ckd-sidebar-logo" />
          <h1>
            <a
              href="./"
              className="ckd-sidebar-home"
              aria-label="weasel home"
              onClick={(e) => { e.preventDefault(); goFront(); }}
            ><Wordmark /></a>
            <VersionPill className="ckd-sidebar-version" />
          </h1>
          <p>{TAGLINE}</p>
          <p><a href="./api/">API reference →</a></p>
          <p><a href="./docs/ui/forge/">Component workshop →</a></p>
          <p><a href="./draw/">WeaselDraw →</a></p>
          <p><a href="./draw/#/dev/toolkits">Toolkit builder →</a></p>
        </header>
        <nav className="ckd-nav">
          <section className="ckd-nav-section ckd-nav-whatsnew">
            <ul>
              <li>
                <a
                  href={`#${GET_STARTED_ID}`}
                  className={activeId === GET_STARTED_ID ? 'active' : ''}
                  onClick={(e) => { e.preventDefault(); open(GET_STARTED_ID); }}
                >🚀 Get started</a>
              </li>
              <li>
                <a
                  href={`#${WHATS_NEW_ID}`}
                  className={activeId === WHATS_NEW_ID ? 'active' : ''}
                  onClick={(e) => { e.preventDefault(); open(WHATS_NEW_ID); }}
                >✨ What's new</a>
              </li>
              <li>
                <a
                  href={`#${RELEASES_ID}`}
                  className={activeId === RELEASES_ID ? 'active' : ''}
                  onClick={(e) => { e.preventDefault(); open(RELEASES_ID); }}
                >🏷️ Releases</a>
              </li>
            </ul>
          </section>
          {CATEGORIES.map((cat) => (
            <section key={cat} className="ckd-nav-section">
              <h2>{cat}</h2>
              <DemoLinks demos={DEMOS.filter((d) => d.category === cat)} activeId={activeId} onPick={open} />
            </section>
          ))}
          {PACKAGES.length > 0 && (
            <section className="ckd-nav-section">
              <h2>Packages</h2>
              {PACKAGES.map((pkg) => (
                <section key={pkg} className="ckd-nav-package">
                  <h3>{pkg}</h3>
                  <DemoLinks demos={DEMOS.filter((d) => d.package === pkg)} activeId={activeId} onPick={open} />
                </section>
              ))}
            </section>
          )}
        </nav>
      </aside>

      <main className="ckd-main">
        <PageBoundary key={activeId} reload={() => window.location.reload()} store={sessionStore()}>
          {active ? <DemoView entry={active} key={active.id} /> : null}
          <Suspense fallback={null}>
            {!active && activeId === GET_STARTED_ID ? <GetStarted /> : null}
            {!active && activeId === RELEASES_ID ? <Releases /> : null}
            {!active && activeId === WHATS_NEW_ID ? <WhatsNew onSelect={open} /> : null}
          </Suspense>
        </PageBoundary>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function DemoLinks({ demos, activeId, onPick }: {
  demos: DemoEntry[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <ul>
      {demos.map((d) => (
        <li key={d.id}>
          <a
            href={`#${d.id}`}
            className={d.id === activeId ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onPick(d.id); }}
          >{d.title}</a>
        </li>
      ))}
    </ul>
  );
}

/** True once `ref`'s element has come near the viewport, and true forever
 *  after — the source it gates stays wanted once it has been asked for. */
function useHasBeenNearViewport(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setNear(true); },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near]);
  return near;
}

/** A source tab's text: `null` while it loads, `'failed'` when it could not be fetched. */
function useSourceText(tab: DemoSourceTab | undefined, enabled: boolean): string | null | 'failed' {
  const [text, setText] = useState<string | null | 'failed'>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the last tab's text while the next one loads
    setText(null);
    if (!tab || !enabled) return;
    let live = true;
    tab.load().then(
      (t) => { if (live) setText(t.trim()); },
      () => { if (live) setText('failed'); },
    );
    return () => { live = false; };
  }, [tab, enabled]);
  return text;
}

function DemoView({ entry }: { entry: DemoEntry }) {
  const Component = entry.Component;
  // Tabs: the demo's primary TSX is always first; companions follow. Paths and
  // languages are known up front; only the visible tab's text is fetched.
  const tabs = entry.sources;
  // Starts on the TSX tab for every demo because the caller keys this view by demo id.
  const [activeTab, setActiveTab] = useState(0);
  const current = tabs[activeTab];
  const panelRef = useRef<HTMLDivElement>(null);
  const code = useSourceText(current, useHasBeenNearViewport(panelRef));

  const source = (
    <div className="ckd-source">
      {code === 'failed' ? (
        <p className="ckd-source-failed" role="status">This file could not be loaded. Reload the page to try again.</p>
      ) : code == null ? <div className="ckd-source-loading" /> : (
        <Suspense fallback={<div className="ckd-source-loading" />}>
          <SourceView code={code} language={current.language} />
        </Suspense>
      )}
    </div>
  );

  return (
    <article className="ckd-demo">
      <header>
        <div className="ckd-eyebrow">
          {placeOf(entry)}
          {entry.lastModified && (
            <>
              <span className="ckd-eyebrow-sep" aria-hidden> · </span>
              <span className="ckd-eyebrow-date">
                last modified <time dateTime={entry.lastModified} title={entry.lastModified}>{formatRelativeOrIso(entry.lastModified)}</time>
              </span>
            </>
          )}
        </div>
        <h2>{entry.title}</h2>
        <p className="ckd-desc"><InlineMarkdown text={entry.description} /></p>
        {entry.links && (
          <p className="ckd-links">
            {entry.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            ))}
          </p>
        )}
      </header>

      <div className="ckd-canvas-wrap">
        <Suspense fallback={<div className="ckd-demo-loading" />}>
          <Component />
        </Suspense>
        {entry.hint && <span className="ckd-hint">{entry.hint}</span>}
      </div>

      <div className="ckd-code-panel" ref={panelRef}>
        {tabs.length > 1 ? (
          <Tabs
            selectedKey={current.path}
            onSelectionChange={(path) => setActiveTab(tabs.findIndex((tab) => tab.path === path))}
          >
            <div className="ckd-code-header">
              <TabList aria-label="Source files" className="ckd-code-tabs">
                {tabs.map((tab) => (
                  <Tab key={tab.path} id={tab.path} className="ckd-code-tab">{tab.path.split('/').pop()}</Tab>
                ))}
              </TabList>
            </div>
            <TabPanel key={current.path} id={current.path} className="ckd-code-tabpanel">{source}</TabPanel>
          </Tabs>
        ) : (
          <>
            <div className="ckd-code-header">
              <span className="ckd-code-meta">{entry.path}</span>
            </div>
            {source}
          </>
        )}
      </div>
    </article>
  );
}

