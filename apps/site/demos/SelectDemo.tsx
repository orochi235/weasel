import { useState, type MouseEvent } from 'react';
import { intentOf, select, type SelectPolicy, type Selection } from '@weasel-js/select';
import { ToggleBar } from '@weasel-js/ui';
import s from './SelectDemo.module.css';

const ROWS = ['Sky', 'Hills', 'Tree', 'Background', 'House', 'Path', 'Fence', 'Sun'];
const LOCKED = new Set(['Background']);

type Convention = 'list' | 'canvas';

const POLICIES: Record<Convention, SelectPolicy> = {
  list: { mode: 'multi', toggle: ['meta', 'ctrl'], range: 'shift' },
  canvas: { mode: 'multi', toggle: 'shift' },
};

const CONVENTIONS: { value: Convention; label: string }[] = [
  { value: 'list', label: 'list: ⌘ toggles, ⇧ ranges' },
  { value: 'canvas', label: 'canvas: ⇧ toggles' },
];

export function SelectDemo() {
  const [convention, setConvention] = useState<Convention>('list');
  const [state, setState] = useState<Selection<string>>({ ids: [], anchor: null });
  const [last, setLast] = useState('—');

  const press = (id: string, e: MouseEvent) => {
    const intent = intentOf({ shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey }, POLICIES[convention]);
    setLast(`${intent} ${id}`);
    setState((prev) => select(prev, id, intent, { order: ROWS, eligible: (x) => !LOCKED.has(x) }));
  };

  return (
    <div className={s.demo}>
      <ToggleBar
        items={CONVENTIONS}
        value={convention}
        onChange={(v) => v && setConvention(v)}
        ariaLabel="Key convention"
        size="sm"
      />
      <div className={s.body}>
        <ul className={s.rows} role="listbox" aria-multiselectable aria-label="Layers">
          {ROWS.map((id) => (
            <li
              key={id}
              role="option"
              aria-selected={state.ids.includes(id)}
              className={s.row}
              data-anchor={state.anchor === id || undefined}
              data-locked={LOCKED.has(id) || undefined}
              onClick={(e) => press(id, e)}
            >
              {id}
              {LOCKED.has(id) && <span className={s.tag}>locked</span>}
              {state.anchor === id && <span className={s.tag}>anchor</span>}
            </li>
          ))}
        </ul>
        <dl className={s.state}>
          <dt>last press</dt>
          <dd>{last}</dd>
          <dt>ids</dt>
          <dd>{state.ids.length > 0 ? state.ids.join(', ') : '—'}</dd>
          <dt>anchor</dt>
          <dd>{state.anchor ?? '—'}</dd>
        </dl>
      </div>
    </div>
  );
}
