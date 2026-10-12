import { useState, useSyncExternalStore } from 'react';
import { createReflectable, type Registrant } from '@weasel-js/registry';
import { Button, ToggleBar } from '@weasel-js/ui';
import s from './RegistryDemo.module.css';

type Tool = 'pen' | 'hand' | 'zoom';
type Source = 'kit' | 'plugin';

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'pen', label: 'pen' },
  { value: 'hand', label: 'hand' },
  { value: 'zoom', label: 'zoom' },
];

const CURSORS: Record<Source, Record<Tool, string>> = {
  kit: { pen: 'crosshair', hand: 'grab', zoom: 'zoom-in' },
  plugin: { pen: 'cell', hand: 'all-scroll', zoom: 'zoom-out' },
};

/** Each tool's CSS cursor, keyed by tool id. */
const cursors = createReflectable<string>();
const { reflection } = cursors;

// A reflection reports a registrant's value and source but not its release, so
// the demo files each release under the three things a row can show.
const releases = new Map<string, () => void>();
const idOf = (key: string, r: Registrant<string>) => `${key}/${r.source}/${r.value}`;

function push(key: Tool, source: Source) {
  const value = CURSORS[source][key];
  const id = idOf(key, { value, source });
  const release = cursors.push(key, value, { source });
  releases.set(id, () => {
    release();
    releases.delete(id);
  });
}

function set(key: Tool) {
  const live = reflection.entries().find((e) => e.key === key);
  // `set` replaces the live registrant, and the release `push` gave for it stops doing anything.
  if (live) releases.delete(idOf(key, live));
  cursors.set(key, 'wait', { source: 'app' });
}

function clear() {
  cursors.clear();
  releases.clear();
}

function Entry({ id, registrant, source }: { id: string; registrant: Registrant<string>; source?: boolean }) {
  const release = releases.get(idOf(id, registrant));
  return (
    <span className={s.registrant}>
      <code>{registrant.value}</code>
      {source && <span className={s.source}>{registrant.source}</span>}
      {release && <Button variant="ghost" size="sm" onClick={release}>release</Button>}
    </span>
  );
}

export function RegistryDemo() {
  const [tool, setTool] = useState<Tool>('pen');
  const version = useSyncExternalStore(reflection.subscribe, reflection.getVersion);
  const entries = reflection.entries();
  const held = (source: Source) => releases.has(idOf(tool, { value: CURSORS[source][tool], source }));

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <ToggleBar items={TOOLS} value={tool} onChange={(v) => v && setTool(v)} ariaLabel="Key" size="sm" />
        <Button size="sm" disabled={held('kit')} onClick={() => push(tool, 'kit')}>push as kit</Button>
        <Button size="sm" disabled={held('plugin')} onClick={() => push(tool, 'plugin')}>push as plugin</Button>
        <Button size="sm" onClick={() => set(tool)}>set as app</Button>
        <Button size="sm" variant="ghost" disabled={entries.length === 0} onClick={clear}>clear</Button>
        <span className={s.version}>version <span className={s.count}>{version}</span></span>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">key</th>
            <th scope="col">live value</th>
            <th scope="col">source</th>
            <th scope="col">shadowed, oldest first</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.key}>
              <th scope="row">{e.key}</th>
              <td><Entry id={e.key} registrant={e} /></td>
              <td>{e.source}</td>
              <td>
                <span className={s.stack}>
                  {e.shadowed.map((r, i) => <Entry key={i} id={e.key} registrant={r} source />)}
                </span>
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className={s.empty}>Nothing registered.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
