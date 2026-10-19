/**
 * Stands in for `DevtoolsPanel` until `@weasel-js/devtools` lands: says `yo`,
 * and lists the roots the page reports. Enough to prove the bridge works.
 */
import { useEffect, useState } from 'react';
import type { DevtoolsRootInfo, PanelTransport } from '@weasel-js/core/devtools';
import { PROTOCOL } from '../envelope';
import s from './panel.module.css';

export function PanelPlaceholder({ transport }: { transport: PanelTransport }) {
  const [kitVersion, setKitVersion] = useState<string | null>(null);
  const [roots, setRoots] = useState<DevtoolsRootInfo[]>([]);

  useEffect(() => {
    const off = transport.onMessage((m) => {
      if (m.type === 'sup') {
        setKitVersion(m.kitVersion);
        setRoots(m.roots);
      } else if (m.type === 'root-added') {
        setRoots((rs) => [...rs.filter((r) => r.id !== m.root.id), m.root]);
      } else if (m.type === 'root-removed') {
        setRoots((rs) => rs.filter((r) => r.id !== m.rootId));
      }
    });
    transport.send({ type: 'yo', protocol: PROTOCOL });
    return () => {
      transport.send({ type: 'bye', protocol: PROTOCOL });
      off();
    };
  }, [transport]);

  if (kitVersion === null) return <p className={s.state}>Connecting to weasel…</p>;
  return (
    <section className={s.placeholder}>
      <h1 className={s.title}>weasel {kitVersion}</h1>
      {roots.length === 0
        ? <p className={s.state}>No canvases mounted.</p>
        : (
          <ul className={s.roots}>
            {roots.map((r) => (
              <li key={r.id}>
                {r.label} <span className={s.meta}>{r.id} · {r.dimension}</span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
