import { useEffect, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CATEGORIES, DEMOS, DEMOS_BY_ID, type DemoEntry } from './registry';
import logoUrl from './weasel-logo.png';

type CodeTab = 'snippet' | 'full';

function readHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return DEMOS_BY_ID.has(h) ? h : DEMOS[0].id;
}

export function CanvasKitDemo() {
  const [activeId, setActiveId] = useState<string>(() => readHash());
  const [tab, setTab] = useState<CodeTab>('snippet');

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
          <h1>weasel</h1>
          <p>Domain-agnostic 2D scene-graph hooks for React + canvas.</p>
          <p><a href="./api/">API reference →</a></p>
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
        <DemoView entry={active} tab={tab} setTab={setTab} key={active.id} />
      </main>
    </div>
  );
}

function DemoView({ entry, tab, setTab }: { entry: DemoEntry; tab: CodeTab; setTab: (t: CodeTab) => void }) {
  const Component = entry.Component;
  const code = tab === 'snippet' ? entry.snippet.trim() : entry.full.trim();

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
        <div className="ckd-code-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'snippet'}
            className={tab === 'snippet' ? 'active' : ''}
            onClick={() => setTab('snippet')}
          >Highlights</button>
          <button
            role="tab"
            aria-selected={tab === 'full'}
            className={tab === 'full' ? 'active' : ''}
            onClick={() => setTab('full')}
          >Full source</button>
          <span className="ckd-code-meta">
            {tab === 'snippet'
              ? 'Curated excerpt — the call sites that matter.'
              : entry.path}
          </span>
        </div>
        <div className="ckd-source">
          <Highlight code={code} language="tsx" theme={themes.vsDark}>
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

