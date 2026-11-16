import { useState, useSyncExternalStore } from 'react';
import { createReflectable, type Registrant } from '@weasel-js/registry';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
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
const cursors = createReflectable<string>({ name: 'cursors' });
const { reflection } = cursors;

const sourceOf = (r: Registrant<string>) => (r.fallback ? `${r.source} (fallback)` : r.source);

function Entry({ id, registrant, source }: { id: string; registrant: Registrant<string>; source?: boolean }) {
  return (
    <span className={s.registrant}>
      <code>{registrant.value}</code>
      {source && <span className={s.source}>{sourceOf(registrant)}</span>}
      <Button variant="ghost" size="sm" onClick={() => cursors.release(id, registrant)}>release</Button>
    </span>
  );
}

export function RegistryDemo() {
  const [tool, setTool] = useState<Tool>('pen');
  const version = useSyncExternalStore(reflection.subscribe, reflection.getVersion);
  const entries = reflection.entries();
  // The kit's cursors are defaults, so a plugin pushing over one is an override, not a clash.
  const push = (source: Source) => cursors.push(tool, CURSORS[source][tool], { source, fallback: source === 'kit' });

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <SegmentedBar items={TOOLS} value={tool} onChange={(v) => v && setTool(v)} aria-label="Key" size="sm" />
        <Button size="sm" onClick={() => push('kit')}>push as kit</Button>
        <Button size="sm" onClick={() => push('plugin')}>push as plugin</Button>
        <Button size="sm" onClick={() => cursors.set(tool, 'wait', { source: 'app' })}>set as app</Button>
        <Button size="sm" variant="ghost" disabled={entries.length === 0} onClick={cursors.clear}>clear</Button>
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
              <td><Entry id={e.key} registrant={e.live} /></td>
              <td>{sourceOf(e.live)}</td>
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
