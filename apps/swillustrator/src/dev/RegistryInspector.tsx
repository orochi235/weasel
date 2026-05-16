import { useEffect } from 'react';
import s from './RegistryInspector.module.css';

/** Bundle Inspector — read-only catalog browser at `#/dev/registry`.
 *  Mounted as a sibling to ToolkitBuilder. See
 *  `docs/superpowers/specs/2026-05-16-bundle-inspector-design.md`. */
export function RegistryInspector() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Bundle Inspector';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className={s.root}>
      <header className={s.header}>
        <h1 className={s.title}>Bundle Inspector</h1>
      </header>
      <div className={s.layout}>
        <aside className={s.tree}>
          <p className={s.empty}>Tree placeholder</p>
        </aside>
        <section className={s.detail}>
          <p className={s.empty}>Select an entry to see details.</p>
        </section>
      </div>
    </div>
  );
}
