import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import { attachMenuDismiss, createMenuController, type MenuController, type MenuEntry } from '@weasel-js/menu';
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
function Panels({ controller, dismiss }: { controller: MenuController; dismiss: () => void }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => controller.subscribe(redraw), [controller]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus(), []);
  useEffect(() => attachMenuDismiss<Event>(window, {
    outside: (e) => !(e.target instanceof Node && root.current?.contains(e.target)),
    close: dismiss,
  }), [dismiss]);
  const stack = controller.stack();
  const id = useId();
  const levelId = (level: number) => `${id}-level-${level}`;
  const rowId = (level: number, key: string) => `${id}-${level}-${key}`;
  const deepest = stack.length - 1;
  const at = stack[deepest];
  const activeEntry = at == null ? undefined : controller.entriesAt(deepest)[at];

  return (
    <div
      ref={root}
      className={s.panels}
      role="menu"
      aria-label="File"
      aria-activedescendant={activeEntry ? rowId(deepest, activeEntry.key) : undefined}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (controller.key(e.key)) e.preventDefault();
      }}
    >
      {stack.map((highlight, level) => {
        const opener = level === 0 ? undefined : controller.entriesAt(level - 1)[stack[level - 1] ?? -1];
        return (
          <ul
            key={level}
            id={levelId(level)}
            className={s.panel}
            role={level === 0 ? 'none' : 'menu'}
            aria-label={opener && opener.kind === 'submenu' ? opener.label : undefined}
          >
            {controller.entriesAt(level).map((entry, index) => {
              if (entry.kind === 'separator') return <li key={entry.key} role="separator" className={s.separator} />;
              const open = entry.kind === 'submenu' && index === highlight && level < deepest;
              return (
                <li
                  key={entry.key}
                  id={rowId(level, entry.key)}
                  role={entry.kind === 'item' && entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={entry.kind === 'item' && entry.checked !== undefined ? entry.checked : undefined}
                  aria-haspopup={entry.kind === 'submenu' ? 'menu' : undefined}
                  aria-expanded={entry.kind === 'submenu' ? open : undefined}
                  aria-owns={open ? levelId(level + 1) : undefined}
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
              );
            })}
          </ul>
        );
      })}
    </div>
  );
}

export function MenuDemo() {
  const [controller, setController] = useState<MenuController | null>(null);
  const [grid, setGrid] = useState(false);
  const [last, setLast] = useState('—');
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => () => controller?.dispose(), [controller]);
  useEffect(() => {
    // A close that took focus with the menu hands it back; one that sent it elsewhere leaves it there.
    if (wasOpen.current && controller === null && (document.activeElement === document.body || document.activeElement === null)) {
      opener.current?.focus();
    }
    wasOpen.current = controller !== null;
  }, [controller]);
  const dismiss = useCallback(() => setController(null), []);

  const open = () =>
    setController(
      createMenuController({
        entries: entriesFor(grid, (what) => setLast(`chose ${what}`), (on) => {
          setGrid(on);
          setLast(`Show grid ${on ? 'on' : 'off'}`);
        }),
        highlightFirst: true,
        onClose: dismiss,
      }),
    );

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <Button ref={opener} onClick={open} disabled={controller !== null}>Open menu</Button>
        <span className={s.last} aria-live="polite">{last}</span>
      </div>
      {controller && <Panels controller={controller} dismiss={dismiss} />}
    </div>
  );
}
