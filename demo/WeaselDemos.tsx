import { useEffect, useMemo, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CATEGORIES, DEMOS, DEMOS_BY_ID, type DemoEntry } from './registry';
// CommandPalette / useCommandPaletteShortcut live in
// apps/swillustrator/src/ui/ after the kit/app split. The demo harness uses
// them for its own command-palette chrome via this relative import.
import {
  CommandPalette,
  useCommandPaletteShortcut,
} from '../apps/swillustrator/src/ui/CommandPalette';
// We deliberately don't import @orochi235/weasel-ui/tokens.css here — the
// demo's own canvas-kit-demo.css supplies dark-theme --wui-* values mapped
// from --ckd-* tokens. Pulling tokens.css would clobber those with the
// light-theme defaults.
import logoUrl from '../weasel-transparent@0.33x.png';

function readHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return DEMOS_BY_ID.has(h) ? h : DEMOS[0].id;
}

export function WeaselDemos() {
  const [activeId, setActiveId] = useState<string>(() => readHash());
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);

  useEffect(() => {
    const onHash = () => setActiveId(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace(/^#/, '') !== activeId) {
      window.history.replaceState(null, '', `#${activeId}`);
    }
  }, [activeId]);

  const active = DEMOS_BY_ID.get(activeId)!;

  return (
    <div className="ckd-app">
      <aside className="ckd-sidebar">
        <header className="ckd-sidebar-header">
          <img src={logoUrl} alt="weasel logo" className="ckd-sidebar-logo" />
          <h1>w<span className="ckd-sidebar-rainbow">easel</span></h1>
          <p>Domain-agnostic 2D scene-graph hooks for React + canvas.</p>
          <p><a href="./api/">API reference →</a></p>
          <p><a href="./docs/ui/storybook/">UI storybook →</a></p>
          <p className="ckd-sidebar-hint">
            Press <kbd>/</kbd> for the command palette.
          </p>
        </header>
        <nav className="ckd-nav">
          {CATEGORIES.map((cat) => (
            <section key={cat} className="ckd-nav-section">
              <h2>{cat}</h2>
              <ul>
                {DEMOS.filter((d) => d.category === cat).map((d) => (
                  <li key={d.id}>
                    <a
                      href={`#${d.id}`}
                      className={d.id === activeId ? 'active' : ''}
                      onClick={(e) => { e.preventDefault(); setActiveId(d.id); }}
                    >{d.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <main className="ckd-main">
        <DemoView entry={active} key={active.id} />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function DemoView({ entry }: { entry: DemoEntry }) {
  const Component = entry.Component;
  // Tabs: the demo's primary TSX is always first; extras (e.g. scene JSON) follow.
  const tabs = useMemo(
    () => [
      { path: entry.path, code: entry.full.trim(), language: 'tsx' as const },
      ...(entry.extras ?? []),
    ],
    [entry],
  );
  const [activeTab, setActiveTab] = useState(0);
  // Reset to the TSX tab when switching demos so we don't try to keep an
  // out-of-range index from the previous entry.
  useEffect(() => { setActiveTab(0); }, [entry]);
  const current = tabs[activeTab];

  return (
    <article className="ckd-demo">
      <header>
        <div className="ckd-eyebrow">{entry.category}</div>
        <h2>{entry.title}</h2>
        <p className="ckd-desc">{entry.description}</p>
      </header>

      <div className="ckd-canvas-wrap">
        <Component />
        {entry.hint && <span className="ckd-hint">{entry.hint}</span>}
      </div>

      <div className="ckd-code-panel">
        <div className="ckd-code-header">
          {tabs.length > 1 ? (
            <div className="ckd-code-tabs" role="tablist">
              {tabs.map((tab, i) => (
                <button
                  key={tab.path}
                  type="button"
                  role="tab"
                  aria-selected={i === activeTab}
                  className={`ckd-code-tab${i === activeTab ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(i)}
                >
                  {tab.path.split('/').pop()}
                </button>
              ))}
            </div>
          ) : (
            <span className="ckd-code-meta">{entry.path}</span>
          )}
        </div>
        <div className="ckd-source">
          <Highlight code={current.code} language={current.language} theme={themes.vsDark}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={className} style={{ ...style, background: 'transparent', margin: 0 }}>
                {tokens.map((line, i) => {
                  const { key: _lk, ...lineProps } = getLineProps({ line });
                  return (
                    <div key={i} {...lineProps}>
                      {line.map((token, j) => {
                        const { key: _tk, ...tokenProps } = getTokenProps({ token });
                        return <span key={j} {...tokenProps} />;
                      })}
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>
        </div>
      </div>
    </article>
  );
}

