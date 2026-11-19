import { useEffect, useReducer, useRef, useState } from 'react';
import { createMenuController, type MenuController, type MenuEntry } from '@weasel-js/menu';
import { Button } from '@weasel-js/ui/components/Button';
import s from './MenuDemo.module.css';

function entriesFor(grid: boolean, chose: (what: string) => void, setGrid: (on: boolean) => void): MenuEntry[] {
  const item = (key: string, label: string): MenuEntry => ({ kind: 'item', key, label, run: () => chose(label) });
  return [
    item('new', 'New'),
    item('open', 'Open…'),
    { kind: 'separator', key: 's1' },
    { kind: 'submenu', key: 'export', label: 'Export', entries: [item('png', 'PNG'), item('svg', 'SVG'), item('pdf', 'PDF')] },
    { kind: 'item', key: 'grid', label: 'Show grid', checked: grid, run: () => setGrid(!grid) },
    { kind: 'separator', key: 's2' },
    { kind: 'item', key: 'delete', label: 'Delete', disabled: true, run: () => chose('Delete') },
  ];
}

/** Every open level of `controller`, drawn by hand: the model owns the highlight, the keys and the submenus. */
function Panels({ controller }: { controller: MenuController }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => controller.subscribe(redraw), [controller]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus(), []);
  const stack = controller.stack();

  return (
    <div
      ref={root}
      className={s.panels}
      role="menu"
      aria-label="File"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (controller.key(e.key)) e.preventDefault();
      }}
    >
      {stack.map((highlight, level) => (
        <ul key={level} className={s.panel}>
          {controller.entriesAt(level).map((entry, index) =>
            entry.kind === 'separator' ? (
              <li key={entry.key} role="separator" className={s.separator} />
            ) : (
              <li
                key={entry.key}
                role="menuitem"
                aria-disabled={'disabled' in entry && entry.disabled ? true : undefined}
                className={index === highlight ? `${s.row} ${s.at}` : s.row}
                onPointerEnter={() => controller.hover(level, index)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  controller.press(level, index);
                }}
              >
                <span className={s.check}>{entry.kind === 'item' && entry.checked ? '✓' : ''}</span>
                <span>{entry.label}</span>
                <span className={s.more}>{entry.kind === 'submenu' ? '›' : ''}</span>
              </li>
            ),
          )}
        </ul>
      ))}
    </div>
  );
}

export function MenuDemo() {
  const [controller, setController] = useState<MenuController | null>(null);
  const [grid, setGrid] = useState(false);
  const [last, setLast] = useState('—');
  useEffect(() => () => controller?.dispose(), [controller]);

  const open = () =>
    setController(
      createMenuController({
        entries: entriesFor(grid, (what) => setLast(`chose ${what}`), (on) => {
          setGrid(on);
          setLast(`Show grid ${on ? 'on' : 'off'}`);
        }),
        highlightFirst: true,
        onClose: () => setController(null),
      }),
    );

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <Button onClick={open} disabled={controller !== null}>Open menu</Button>
        <span className={s.last} aria-live="polite">{last}</span>
      </div>
      {controller && <Panels controller={controller} />}
    </div>
  );
}
