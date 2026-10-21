import { Suspense, lazy, useEffect, useRef, useState, type RefObject } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { DEMOS, DEMOS_BY_ID, placeOf, type DemoEntry, type DemoSourceTab } from './registry';
import { sessionStore } from './chunkReload';
import { PageBoundary } from './PageBoundary';
import { TAGLINE } from './FrontPage/tagline';
import { VersionPill } from './FrontPage/VersionPill';
import { Wordmark } from './FrontPage/Wordmark';
import { DEMOS_ID, FRONT_ID, GET_STARTED_ID, RELEASES_ID, WHATS_NEW_ID, goFront, routeOf } from './routes';
import { isPackagePage } from './Packages/catalog';
import { SiteNav } from './SiteNav';
import { DemoFrame } from './DemoFrame';
import { DevtoolsSplit } from './DevtoolsSplit';

// These are lazy so the entry bundle carries only the nav: `Releases`
// pulls in `virtual:changelogs` (every published changelog entry), and
// `SourceView` pulls in `prism-react-renderer`. None is needed to show a demo.
const SourceView = lazy(() => import('./SourceView'));
const PackagePages = lazy(() => import('./Packages/Packages'));
const WhatsNew = lazy(() => import('./WhatsNew').then((m) => ({ default: m.WhatsNew })));
const Releases = lazy(() => import('./Releases').then((m) => ({ default: m.Releases })));
const GetStarted = lazy(() => import('./FrontPage/GetStarted').then((m) => ({ default: m.GetStarted })));
// A development aid only: production carries neither the toggle nor the panel.
const DemoDevtools = import.meta.env.DEV ? lazy(() => import('./DemoDevtools')) : null;

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
import { ColorModeControl } from '@weasel-js/ui/components/ColorModeControl';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { Switch } from '@weasel-js/ui/components/Switch';
import { SiteColorModeContext, useSiteColorMode } from './colorMode';
import { useCommandPaletteShortcut } from './CommandPalette/useCommandPaletteShortcut';
import logoUrl from './assets/weasel-logo.svg';

function readHash(): string {
  if (window.location.hash === `#${DEMOS_ID}`) return DEMOS[0].id;
  return routeOf(window.location.hash, (id) => DEMOS_BY_ID.has(id) || isPackagePage(id));
}

export function WeaselDemos() {
  const [activeId, setActiveId] = useState<string>(() => readHash());
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);
  const colorMode = useSiteColorMode();

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

  // The main pane is what scrolls, so a new page starts at its top, not where the last one was left.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
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
          <p><a href="./docs/ui/forge/">UI catalog →</a></p>
          <p><a href="./draw/">WeaselDraw →</a></p>
          <p><a href="./draw/#/dev/toolkits">Toolkit builder →</a></p>
          <p><a href="./chart/">WeaselChart →</a></p>
          <ColorModeControl
            className="ckd-sidebar-mode"
            value={colorMode.preference}
            onChange={colorMode.setPreference}
            size="sm"
          />
        </header>
        <SiteNav activeId={activeId} onPick={open} />
      </aside>

      <main className="ckd-main" ref={mainRef}>
        <PageBoundary key={activeId} reload={() => window.location.reload()} store={sessionStore()}>
          {active ? (
            <SiteColorModeContext.Provider value={colorMode.mode}>
              <DemoView entry={active} key={active.id} />
            </SiteColorModeContext.Provider>
          ) : null}
          <Suspense fallback={null}>
            {!active && activeId === GET_STARTED_ID ? <GetStarted /> : null}
            {!active && activeId === RELEASES_ID ? <Releases /> : null}
            {!active && activeId === WHATS_NEW_ID ? <WhatsNew onSelect={open} /> : null}
            {!active && isPackagePage(activeId) ? <PackagePages id={activeId} /> : null}
          </Suspense>
        </PageBoundary>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
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
  const [devtools, setDevtools] = useState(false);

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
        {DemoDevtools && <Switch isSelected={devtools} onChange={setDevtools}>Devtools</Switch>}
      </header>

      <DevtoolsSplit panel={DemoDevtools && devtools ? <Suspense fallback={null}><DemoDevtools /></Suspense> : null}>
        <div className="ckd-canvas-wrap">
          <Suspense fallback={<div className="ckd-demo-loading" />}>
            <DemoFrame label={entry.title}>
              <Component />
            </DemoFrame>
          </Suspense>
          {entry.hint && <span className="ckd-hint"><InlineMarkdown text={entry.hint} /></span>}
        </div>
      </DevtoolsSplit>

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

