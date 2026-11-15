import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createHistory, type History, type HistoryEntry, type Journal, type Op } from '@weasel-js/history';
import { Disabled } from '@weasel-js/ui/components/Disabled';
import { HistoryList } from '@weasel-js/ui/components/HistoryList';
import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import s from './HistoryDemo.module.css';

interface Chip {
  id: string;
  hue: number;
}

interface Board {
  chips: Chip[];
}

const board = (adapter: unknown) => adapter as Board;

function insertOp(chip: Chip, index: number): Op {
  return {
    name: 'insert',
    args: { node: chip },
    apply: (a) => {
      const chips = [...board(a).chips];
      chips.splice(index, 0, chip);
      board(a).chips = chips;
    },
    invert: () => removeOp(chip, index),
  };
}

function removeOp(chip: Chip, index: number): Op {
  return {
    name: 'remove',
    args: { node: chip },
    apply: (a) => {
      board(a).chips = board(a).chips.filter((c) => c.id !== chip.id);
    },
    invert: () => insertOp(chip, index),
  };
}

function recolorOp(id: string, from: number, to: number): Op {
  return {
    name: 'recolor',
    args: { id, from, to },
    coalesceKey: `hue:${id}`,
    apply: (a) => {
      if (from === to) return 'noop';
      board(a).chips = board(a).chips.map((c) => (c.id === id ? { ...c, hue: to } : c));
      return true;
    },
    invert: () => recolorOp(id, to, from),
  };
}

const GOLDEN = 137.5;
function create() {
  let nextId = 1;
  const mint = (hue: number): Chip => ({ id: `c${nextId++}`, hue: Math.round(hue % 360) });
  const b: Board = { chips: [20, 140, 210, 300].map(mint) };
  return { board: b, mint, history: createHistory(b, { coalesceWindowMs: 600 }) };
}

const noSubscribe = () => () => {};
const noVersion = () => 0;

/** One stack's states, oldest first, with the redoable ones after the current. Picking one steps there. */
function Stack({ label, stack, base }: { label: string; stack: History | Journal; base: string }) {
  const { undo, redo } = stack.entries();
  const entries = [
    { id: 'base', label: base },
    ...[...undo, ...redo].map((e: HistoryEntry) => ({
      id: String(e.id),
      label: (
        <>
          <span>{e.label}</span>
          {e.pushes > 1 && <span className={s.pushes}>×{e.pushes}</span>}
        </>
      ),
    })),
  ];
  const jump = (to: number) => {
    for (let at = undo.length; at > to; at--) stack.undo();
    for (let at = undo.length; at < to; at++) stack.redo();
  };
  return (
    <section className={s.stack}>
      <h3 className={s.stackTitle}>{label}</h3>
      <HistoryList aria-label={label} entries={entries} current={undo.length} onJump={jump} />
    </section>
  );
}

export function HistoryDemo() {
  const [{ board: b, mint, history }] = useState(create);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [selected, setSelected] = useState<string | null>(b.chips[0]?.id ?? null);
  useSyncExternalStore(history.subscribe, history.getVersion);
  useSyncExternalStore(journal?.subscribe ?? noSubscribe, journal?.getVersion ?? noVersion);

  const run = (ops: Op[], label: string) => {
    if (journal) journal.applyOps(ops, label);
    else history.applyOps(ops, label);
  };
  const step = (dir: 'undo' | 'redo') => (journal ?? history)[dir]();

  const chip = b.chips.find((c) => c.id === selected);
  const add = () => {
    const last = b.chips[b.chips.length - 1];
    const c = mint((last?.hue ?? 0) + GOLDEN);
    run([insertOp(c, b.chips.length)], `Add ${c.id}`);
    setSelected(c.id);
  };
  const remove = () => {
    if (!chip) return;
    run([removeOp(chip, b.chips.indexOf(chip))], `Remove ${chip.id}`);
    setSelected(null);
  };
  const recolor = (hue: number) => chip && run([recolorOp(chip.id, chip.hue, hue)], `Recolor ${chip.id}`);

  const begin = () => {
    setJournal(history.beginJournal({ label: 'Edit session' }));
  };
  const end = (how: 'commit' | 'cancel') => {
    if (!journal) return;
    if (how === 'commit') journal.commit('Edit session');
    else journal.cancel();
    setJournal(null);
    if (selected && !b.chips.some((c) => c.id === selected)) setSelected(null);
  };

  const active = journal ?? history;

  return (
    <div className={s.demo}>
      <div className={s.chips}>
        {b.chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={c.id === selected ? `${s.chip} ${s.selected}` : s.chip}
            style={{ '--hue': c.hue } as CSSProperties}
            onClick={() => setSelected(c.id)}
          >
            {c.id}
          </button>
        ))}
      </div>

      <div className={s.controls}>
        <Button onClick={add}>Add</Button>
        <Button onClick={remove} disabled={!chip}>Remove</Button>
        <Field orientation="row" className="ckd-field" label="hue" output={<span className={s.readout}>{chip ? chip.hue : ''}</span>}>
          <InlineRange
            min={0}
            max={359}
            value={chip?.hue ?? 0}
            disabled={!chip}
            onChange={(e) => recolor(Number(e.currentTarget.value))}
            onPointerUp={() => active.seal()}
          />
        </Field>
        <span className={s.sep} />
        <Button onClick={() => step('undo')} disabled={!active.canUndo()}>Undo</Button>
        <Button onClick={() => step('redo')} disabled={!active.canRedo()}>Redo</Button>
      </div>

      <div className={s.controls}>
        {journal ? (
          <>
            <Button onClick={() => end('commit')}>Commit session</Button>
            <Button onClick={() => end('cancel')}>Discard session</Button>
            <span className={s.hint}>Undo and redo now step inside the session.</span>
          </>
        ) : (
          <Button onClick={begin}>Begin edit session</Button>
        )}
      </div>

      <div className={s.stacks}>
        <Disabled when={journal !== null} reason="The session holds undo until it ends">
          <Stack label="history" stack={history} base="Initial" />
        </Disabled>
        {journal && <Stack label="session" stack={journal} base="Session start" />}
      </div>
    </div>
  );
}
