import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ActionDisabledReason,
  DEFAULT_ALLOWED_CAPABILITIES,
  buildRuleCtx,
  createDepRegistry,
  createDispatcher,
  defineTool,
  openPointerSession,
  pastDragThreshold,
  resolveParams,
  routesForSpec,
  type Action,
  type DispatcherContext,
  type InputEvent,
  type ModifierState,
  type NodeId,
  type ResolvedCandidate,
  type Rule,
  type Tool,
} from '@weasel-js/routing';
import s from './RoutingDemo.module.css';

interface Box { id: NodeId; x: number; y: number; color: number }
interface Rect { x0: number; y0: number; x1: number; y1: number }
interface Board { boxes: Box[]; selected: NodeId[]; pan: { x: number; y: number }; marquee: Rect | null }

const W = 380;
const H = 240;
const SIZE = 56;
const COLORS = 4;
const LOG_LINES = 6;
const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'Control', 'Meta']);
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

const nodeId = (id: string) => id as NodeId;

const INITIAL: Board = {
  boxes: [
    { id: nodeId('A'), x: 40, y: 50, color: 0 },
    { id: nodeId('B'), x: 160, y: 120, color: 1 },
    { id: nodeId('C'), x: 280, y: 40, color: 2 },
  ],
  selected: [],
  pan: { x: 0, y: 0 },
  marquee: null,
};

// No action here reads a dep; each closes over the board instead.
const NO_DEPS = createDepRegistry();
const UNLOCKED: Rule = { mode: { not: 'locked' } };

const HAND = defineTool<unknown>({ id: 'hand', bindings: [{ spec: { kind: 'drag' }, actionId: 'pan' }] });
const TOOLS: ReadonlyMap<string, Tool> = new Map([[HAND.id, HAND]]);

function boxAt(b: Board, x: number, y: number): Box | undefined {
  return [...b.boxes].reverse().find((box) => x >= box.x && x <= box.x + SIZE && y >= box.y && y <= box.y + SIZE);
}

function normalize(r: Rect): Rect {
  return { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
}

function makeActions(get: () => Board, set: (b: Board) => void): Action[] {
  const needsSelection = () => (get().selected.length > 0 ? true : ActionDisabledReason.SelectionRequired);
  const at = (p?: Record<string, unknown>) => boxAt(get(), p?.worldX as number, p?.worldY as number);

  return [
    {
      id: 'select',
      label: 'Select',
      defaultBinding: [
        { kind: 'click', target: 'kind:box' },
        { spec: { kind: 'click', target: 'kind:box', mods: { shift: true } }, opts: { params: { extend: true } } },
      ],
      invoker: {
        timing: 'immediate',
        run: (_deps, p) => {
          const b = get();
          const hit = at(p);
          if (!hit) return;
          const on = b.selected.includes(hit.id);
          const selected = !p?.extend ? [hit.id] : on ? b.selected.filter((id) => id !== hit.id) : [...b.selected, hit.id];
          set({ ...b, selected });
        },
      },
    },
    {
      id: 'recolor',
      label: 'Recolor',
      defaultBinding: { kind: 'click', target: 'kind:box:selected' },
      eligible: UNLOCKED,
      invoker: {
        timing: 'immediate',
        run: (_deps, p) => {
          const b = get();
          const hit = at(p);
          if (!hit) return;
          set({ ...b, boxes: b.boxes.map((box) => (box === hit ? { ...box, color: (box.color + 1) % COLORS } : box)) });
        },
      },
    },
    {
      id: 'deselect',
      label: 'Deselect',
      defaultBinding: [{ kind: 'click', target: 'empty' }, { kind: 'key', key: 'Escape' }],
      enabled: needsSelection,
      invoker: { timing: 'immediate', run: () => set({ ...get(), selected: [] }) },
    },
    {
      id: 'delete',
      label: 'Delete',
      defaultBinding: { kind: 'key', key: ['Delete', 'Backspace'] },
      eligible: UNLOCKED,
      enabled: needsSelection,
      invoker: {
        timing: 'immediate',
        run: () => {
          const b = get();
          set({ ...b, boxes: b.boxes.filter((box) => !b.selected.includes(box.id)), selected: [] });
        },
      },
    },
    {
      id: 'move',
      label: 'Move',
      defaultBinding: { kind: 'drag', target: 'kind:box' },
      eligible: UNLOCKED,
      invoker: {
        timing: 'ongoing',
        start: (ctx) => {
          const b = get();
          const hit = boxAt(b, ctx.world.x, ctx.world.y);
          if (!hit) return {};
          const selected = b.selected.includes(hit.id) ? b.selected : [hit.id];
          const origins = new Map(b.boxes.filter((box) => selected.includes(box.id)).map((box) => [box.id, box]));
          set({ ...b, selected });
          return {
            kind: 'move',
            onMove: (c) => {
              const d = c.drag?.delta ?? { x: 0, y: 0 };
              const cur = get();
              set({
                ...cur,
                boxes: cur.boxes.map((box) => {
                  const o = origins.get(box.id);
                  return o ? { ...box, x: o.x + d.x, y: o.y + d.y } : box;
                }),
              });
            },
          };
        },
      },
    },
    {
      id: 'marquee',
      label: 'Marquee select',
      defaultBinding: [
        { kind: 'drag' },
        { spec: { kind: 'drag', mods: { shift: true } }, opts: { params: { extend: true } } },
      ],
      invoker: {
        timing: 'ongoing',
        start: (ctx, opts) => {
          const extend = resolveParams(opts?.params)?.extend === true;
          const { x, y } = ctx.world;
          set({ ...get(), marquee: { x0: x, y0: y, x1: x, y1: y } });
          return {
            kind: 'marquee',
            onMove: (c) => {
              const cur = c.drag?.current ?? c.world;
              set({ ...get(), marquee: { x0: x, y0: y, x1: cur.x, y1: cur.y } });
            },
            onEnd: (_c, reason) => {
              const b = get();
              if (!b.marquee || reason === 'cancel') return set({ ...b, marquee: null });
              const r = normalize(b.marquee);
              const hits = b.boxes
                .filter((box) => box.x < r.x1 && box.x + SIZE > r.x0 && box.y < r.y1 && box.y + SIZE > r.y0)
                .map((box) => box.id);
              const selected = extend ? [...new Set([...b.selected, ...hits])] : hits;
              set({ ...b, selected, marquee: null });
            },
          };
        },
      },
    },
    {
      // Bound only by the hand tool, so it reaches the dispatcher at the active or hotkey tier.
      id: 'pan',
      label: 'Pan',
      invoker: {
        timing: 'ongoing',
        start: () => {
          const from = get().pan;
          return {
            kind: 'pan',
            onMove: (c) => {
              const d = c.drag?.screenDelta;
              if (d) set({ ...get(), pan: { x: from.x + d.x, y: from.y + d.y } });
            },
          };
        },
      },
    },
  ];
}

function modsOf(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
  return { altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey };
}

function modLabel(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): string {
  return [e.shiftKey && 'shift', e.altKey && 'alt', e.ctrlKey && 'ctrl', e.metaKey && 'meta']
    .filter(Boolean)
    .map((m) => ` +${m}`)
    .join('');
}

function verdictText(v: ResolvedCandidate['verdict']): string {
  switch (v.kind) {
    case 'would-fire': return 'fires';
    case 'ineligible': return `ineligible: ${v.reason}`;
    case 'disabled': return `disabled: ${v.reason}`;
    case 'shadowed': return 'outranked';
  }
}

interface Trace { label: string; candidates: ResolvedCandidate[]; outcome: 'handled' | 'unhandled' }

export function RoutingDemo() {
  const [board, setBoard] = useState(INITIAL);
  const boardRef = useRef(board);
  const [flags, setFlags] = useState({ hand: false, locked: false, space: false });
  const flagsRef = useRef(flags);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const commit = (b: Board) => {
    boardRef.current = b;
    setBoard(b);
  };
  const setFlag = (key: keyof typeof flags, value: boolean) => {
    flagsRef.current = { ...flagsRef.current, [key]: value };
    setFlags(flagsRef.current);
  };

  const [{ dispatcher, actions }] = useState(() => ({
    dispatcher: createDispatcher(),
    actions: makeActions(() => boardRef.current, commit),
  }));

  const context = (modifiers: ModifierState): DispatcherContext => {
    const f = flagsRef.current;
    return {
      actions: { list: () => actions },
      depRegistry: NO_DEPS,
      activeToolId: f.hand ? HAND.id : null,
      hotkeyStack: f.space ? [HAND.id] : [],
      entriesById: TOOLS,
      isMac: IS_MAC,
      getRuleCtx: () => buildRuleCtx({
        focused: true,
        selection: boardRef.current.selected,
        multiActive: false,
        modifiers,
        action: dispatcher.getActiveAction(),
        hover: null,
        mode: f.locked ? 'locked' : 'normal',
        allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES,
      }),
    };
  };

  const pump = (event: InputEvent) =>
    dispatcher.handleInput(event, context({ alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey }));

  const route = (event: InputEvent, label: string) => {
    const ctx = context({ alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
    const candidates = dispatcher.resolveAll(event, ctx, { evaluateShadowed: true });
    const outcome = dispatcher.handleInput(event, ctx);
    setTrace({ label, candidates, outcome });
    const winner = candidates.find((c) => c.verdict.kind === 'would-fire');
    if (outcome === 'handled' && winner) setLog((l) => [`${label} → ${winner.actionId}`, ...l].slice(0, LOG_LINES));
    return outcome;
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const svg = e.currentTarget;
    svg.focus();
    const rect = svg.getBoundingClientRect();
    const toWorld = (cx: number, cy: number) => ({
      x: cx - rect.left - boardRef.current.pan.x,
      y: cy - rect.top - boardRef.current.pan.y,
    });
    const start = toWorld(e.clientX, e.clientY);
    const b = boardRef.current;
    const hit = boxAt(b, start.x, start.y);
    const selected = hit !== undefined && b.selected.includes(hit.id);
    const body = hit
      ? { bodyTarget: selected ? 'selected-body' as const : 'unselected-body' as const, bodyKind: 'box' }
      : { bodyTarget: 'empty' as const };
    const mods = modsOf(e);
    const where = hit ? `box ${hit.id}${selected ? ' (selected)' : ''}` : 'empty';
    const pointerId = e.pointerId;
    let dragging = false;

    openPointerSession(svg, e, {
      onMove: (m) => {
        if (!dragging) {
          if (!pastDragThreshold(e, m)) return;
          dragging = true;
          route(
            { kind: 'pointerdown', ...mods, ...body, x: start.x, y: start.y, clientX: e.clientX, clientY: e.clientY, pointerId },
            `drag on ${where}${modLabel(mods)}`,
          );
        }
        const p = toWorld(m.clientX, m.clientY);
        pump({ kind: 'pointermove', ...modsOf(m), x: p.x, y: p.y, clientX: m.clientX, clientY: m.clientY, pointerId });
      },
      onEnd: (u) => {
        const p = toWorld(u.clientX, u.clientY);
        if (dragging) {
          pump({ kind: 'pointerup', ...modsOf(u), x: p.x, y: p.y, clientX: u.clientX, clientY: u.clientY, pointerId });
        } else {
          route(
            { kind: 'click', ...mods, ...body, x: p.x, y: p.y, pressX: start.x, pressY: start.y, clientX: u.clientX, clientY: u.clientY },
            `click on ${where}${modLabel(mods)}`,
          );
        }
      },
      onCancel: () => {
        if (dragging) pump({ kind: 'pointercancel', ...mods, pointerId });
      },
    });
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) setFlag('space', true);
      return;
    }
    if (e.repeat || MODIFIER_KEYS.has(e.key)) return;
    if (route({ kind: 'key', key: e.key, ...modsOf(e) }, `key ${e.key}${modLabel(e)}`) === 'handled') e.preventDefault();
  };

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <button
          type="button"
          className={`ckd-btn ${flags.hand ? s.active : ''}`}
          aria-pressed={flags.hand}
          onClick={() => setFlag('hand', !flags.hand)}
        >
          Hand tool active
        </button>
        <button
          type="button"
          className={`ckd-btn ${flags.locked ? s.active : ''}`}
          aria-pressed={flags.locked}
          onClick={() => setFlag('locked', !flags.locked)}
        >
          Locked mode
        </button>
        <span className={`${s.tag} ${flags.space ? s.on : ''}`}>Space held: hand at hotkey tier</span>
      </div>

      <svg
        className={s.stage}
        width={W}
        height={H}
        tabIndex={0}
        aria-label="Routing surface"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => e.key === ' ' && setFlag('space', false)}
        onBlur={() => setFlag('space', false)}
      >
        <g transform={`translate(${board.pan.x} ${board.pan.y})`}>
          {board.boxes.map((box) => (
            <g key={box.id} className={board.selected.includes(box.id) ? s.selected : undefined}>
              <rect className={`${s.box} ${s[`c${box.color}`]}`} x={box.x} y={box.y} width={SIZE} height={SIZE} rx={4} />
              <text className={s.label} x={box.x + SIZE / 2} y={box.y + SIZE / 2}>{box.id}</text>
            </g>
          ))}
          {board.marquee && (() => {
            const r = normalize(board.marquee);
            return <rect className={s.marquee} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} />;
          })()}
        </g>
      </svg>

      <div className={s.trace}>
        {trace === null ? (
          <p className={s.hint}>Click, drag or press a key on the surface.</p>
        ) : (
          <>
            <p className={s.input}>
              <code>{trace.label}</code> <span className={trace.outcome === 'handled' ? s.handled : s.unhandled}>{trace.outcome}</span>
            </p>
            {trace.candidates.length === 0 ? (
              <p className={s.hint}>No binding matched this input.</p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>action</th>
                    <th>binding</th>
                    <th>tier</th>
                    <th title="target, modifiers, phase, exact">specificity</th>
                    <th>verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.candidates.map((c, i) => (
                    <tr key={i} className={c.verdict.kind === 'would-fire' ? s.winner : undefined}>
                      <td className={s.mono}>{c.actionId}</td>
                      <td className={s.mono}>{routesForSpec(c.binding.spec).join(', ') || c.binding.spec.kind}</td>
                      <td>{c.scope}{c.ownerId ? ` (${c.ownerId})` : ''}</td>
                      <td className={s.mono}>{c.specificity.join(' ')}</td>
                      <td className={s[c.verdict.kind]}>{verdictText(c.verdict)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <ol className={s.log}>
        {log.map((line, i) => <li key={`${log.length}-${i}-${line}`}>{line}</li>)}
      </ol>
    </div>
  );
}
