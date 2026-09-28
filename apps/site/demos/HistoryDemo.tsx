import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createHistory, type HistoryEntry, type Journal, type Op } from '@weasel-js/history';
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

function Stack({ title, entries, next, empty }: { title: string; entries: readonly HistoryEntry[]; next?: number; empty: string }) {
  return (
    <section className={s.stack}>
      <h3 className={s.stackTitle}>{title}</h3>
      {entries.length === 0 && <p className={s.empty}>{empty}</p>}
      <ol className={s.entries}>
        {entries.map((e) => (
          <li key={e.id} className={e.id === next ? `${s.entry} ${s.next}` : s.entry}>
            <span className={s.label}>{e.label}</span>
            {e.pushes > 1 && <span className={s.pushes}>×{e.pushes}</span>}
            <span className={s.id}>#{e.id}</span>
          </li>
        ))}
      </ol>
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
    if (journal) journal.applyBatch(ops, label);
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
  const parent = history.entries();
  const session = journal?.entries();

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
        <button type="button" className="ckd-btn" onClick={add}>Add</button>
        <button type="button" className="ckd-btn" onClick={remove} disabled={!chip}>Remove</button>
        <label className="ckd-field">
          hue
          <input
            type="range"
            className="ckd-range"
            min={0}
            max={359}
            value={chip?.hue ?? 0}
            disabled={!chip}
            onChange={(e) => recolor(Number(e.currentTarget.value))}
            onPointerUp={() => active.seal()}
          />
          <span className={s.readout}>{chip ? chip.hue : ''}</span>
        </label>
        <span className={s.sep} />
        <button type="button" className="ckd-btn" onClick={() => step('undo')} disabled={!active.canUndo()}>Undo</button>
        <button type="button" className="ckd-btn" onClick={() => step('redo')} disabled={!active.canRedo()}>Redo</button>
      </div>

      <div className={s.controls}>
        {journal ? (
          <>
            <button type="button" className="ckd-btn" onClick={() => end('commit')}>Commit session</button>
            <button type="button" className="ckd-btn" onClick={() => end('cancel')}>Discard session</button>
            <span className={s.hint}>Undo and redo now step inside the session.</span>
          </>
        ) : (
          <button type="button" className="ckd-btn" onClick={begin}>Begin edit session</button>
        )}
      </div>

      <div className={s.stacks}>
        <Stack title="undo" entries={parent.undo} next={journal ? undefined : parent.undo.at(-1)?.id} empty="nothing to undo" />
        <Stack title="redo" entries={parent.redo} next={journal ? undefined : parent.redo[0]?.id} empty="nothing to redo" />
        {session && (
          <>
            <Stack title="session undo" entries={session.undo} next={session.undo.at(-1)?.id} empty="no session edits" />
            <Stack title="session redo" entries={session.redo} next={session.redo[0]?.id} empty="nothing to redo" />
          </>
        )}
      </div>
    </div>
  );
}
