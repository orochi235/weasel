import { useEffect, useRef, useState } from 'react';
import {
  describeRouteParts,
  formatPhaseAtom,
  formatRoute,
  getGestureDescriptor,
  keyRouteToSpec,
  matchSpec,
  parseKeyRoute,
  parseRoute,
  ROUTE_FIELD_DEFINITIONS,
  type BodyTarget,
  type GestureSpec,
  type InputEvent,
  type ParsedRoute,
  type PhaseContext,
} from '@weasel-js/gestures';
import s from './GestureGrammarDemo.module.css';

const PRESETS = [
  '[initial] click => empty +shift',
  '[engaged] wheel(up) ?shift',
  '[*:engaged] keyDown(Escape)',
  '[initial,engaged] contextMenu => node',
  '[rect:initial] drag +mod +alt',
  '[*] multiTouchTap(3)',
];

function parse(route: string): { parsed: ParsedRoute } | { error: string } {
  try {
    return { parsed: parseRoute(route) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const undo = keyRouteToSpec(parseKeyRoute('z?shift'));

const SPECS: GestureSpec[] = [
  { kind: 'pointerDown', target: 'unselected-body' },
  { kind: 'click', target: 'empty' },
  { kind: 'click', target: 'kind:rect', mods: { shift: true } },
  { kind: 'doubleClick' },
  { kind: 'drag', target: 'kind:rect:selected' },
  { kind: 'drag', mods: { alt: true, shift: 'optional' } },
  { kind: 'contextMenu', target: 'selected-body' },
  { kind: 'wheel', direction: 'up', mods: { mod: true } },
  { kind: 'wheel', phase: 'engaged' },
  { kind: 'key', key: ['Delete', 'Backspace'] },
  { ...undo, mods: { ...undo.mods, mod: true } },
  { kind: 'key', key: 'Escape', phase: [{ channel: '*', phase: 'engaged' }] },
];

const specText = ({ kind, ...rest }: GestureSpec) =>
  `${kind} ${JSON.stringify(rest)}`.replace(/ \{\}$/, '');

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);
const SELF = 'pad';
const THRESHOLD = 4;
const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'Control', 'Meta']);

function modsOf(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
  return { altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey };
}

// Hit-test by point: pointer capture retargets up, click and dblclick to the pad itself.
function bodyAt(x: number, y: number): { bodyTarget: BodyTarget; bodyKind?: string } {
  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-body]');
  if (!hit) return { bodyTarget: 'empty' };
  return { bodyTarget: hit.dataset.body as BodyTarget, bodyKind: hit.dataset.kind };
}

function summarize(e: InputEvent): string {
  const held = [
    'metaKey' in e && e.metaKey && 'meta',
    'ctrlKey' in e && e.ctrlKey && 'ctrl',
    'altKey' in e && e.altKey && 'alt',
    'shiftKey' in e && e.shiftKey && 'shift',
  ].filter(Boolean);
  const bits: string[] = [e.kind];
  if (e.kind === 'pointerdown' && e.stage) bits.push(`stage=${e.stage}`);
  if (e.kind === 'key') bits.push(`key=${e.key}`);
  if (e.kind === 'wheel') bits.push(`deltaY=${e.deltaY.toFixed(0)}`);
  if ('bodyTarget' in e && e.bodyTarget) bits.push(e.bodyTarget);
  if ('bodyKind' in e && e.bodyKind) bits.push(`kind=${e.bodyKind}`);
  if (held.length) bits.push(`+${held.join('+')}`);
  return bits.join(' ');
}

interface Logged {
  n: number;
  event: InputEvent;
  engaged: boolean;
  matched: number[];
}

export function GestureGrammarDemo() {
  const [route, setRoute] = useState(PRESETS[0]!);
  const result = parse(route);

  const [log, setLog] = useState<Logged[]>([]);
  const [engaged, setEngaged] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const engagedRef = useRef(false);
  const counter = useRef(0);

  const emit = (event: InputEvent) => {
    const ctx: PhaseContext = {
      selfChannel: SELF,
      engagedChannels: new Set(engagedRef.current ? [SELF] : []),
    };
    const matched = SPECS.flatMap((spec, i) => (matchSpec(event, spec, IS_MAC, ctx) ? [i] : []));
    const entry = { n: ++counter.current, event, engaged: engagedRef.current, matched };
    setLog((prev) => [entry, ...prev].slice(0, 8));
  };
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const setEngagedBoth = (v: boolean) => {
    engagedRef.current = v;
    setEngaged(v);
  };

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    // React's onWheel is passive, so it cannot stop the page scrolling.
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      emitRef.current({
        kind: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY, clientX: e.clientX, clientY: e.clientY,
        ...modsOf(e), ...bodyAt(e.clientX, e.clientY),
      });
    };
    pad.addEventListener('wheel', onWheel, { passive: false });
    return () => pad.removeEventListener('wheel', onWheel);
  }, []);

  const latest = log[0];

  return (
    <div className={s.demo}>
      <section className={s.section}>
        <h3 className={s.heading}>A route string, parsed</h3>
        <input
          className={`${s.route} ${'error' in result ? s.invalid : ''}`}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          spellCheck={false}
          aria-label="Route"
        />
        <div className={s.presets}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className="ckd-btn" onClick={() => setRoute(p)}>{p}</button>
          ))}
        </div>
        {'error' in result ? (
          <p className={s.error}>{result.error}</p>
        ) : (
          <ParsedView parsed={result.parsed} />
        )}
      </section>

      <section className={s.section}>
        <h3 className={s.heading}>Specs matched against what you do</h3>
        <div
          ref={padRef}
          className={`${s.pad} ${engaged ? s.engaged : ''}`}
          tabIndex={0}
          role="application"
          aria-label="Gesture pad"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            press.current = { x: e.clientX, y: e.clientY, dragging: false };
            emit({ kind: 'pointerdown', stage: 'press', ...modsOf(e), ...bodyAt(e.clientX, e.clientY) });
          }}
          onPointerMove={(e) => {
            const p = press.current;
            if (!p || p.dragging) return;
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD) return;
            p.dragging = true;
            emit({ kind: 'pointerdown', ...modsOf(e), ...bodyAt(p.x, p.y) });
            setEngagedBoth(true);
          }}
          onPointerUp={(e) => {
            const p = press.current;
            press.current = null;
            if (!p) return;
            if (p.dragging) setEngagedBoth(false);
            else emit({ kind: 'click', ...modsOf(e), ...bodyAt(e.clientX, e.clientY) });
          }}
          onPointerCancel={() => {
            press.current = null;
            setEngagedBoth(false);
          }}
          onDoubleClick={(e) => emit({ kind: 'doubleclick', ...modsOf(e), ...bodyAt(e.clientX, e.clientY) })}
          onContextMenu={(e) => {
            e.preventDefault();
            emit({ kind: 'contextmenu', ...modsOf(e), ...bodyAt(e.clientX, e.clientY) });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab' || MODIFIER_KEYS.has(e.key)) return;
            e.preventDefault();
            emit({ kind: 'key', key: e.key, repeat: e.repeat, ...modsOf(e) });
          }}
        >
          <div className={`${s.body} ${s.selected}`} data-body="selected-body" data-kind="rect">
            rect, selected
          </div>
          <div className={s.body} data-body="unselected-body" data-kind="rect">
            rect
          </div>
          <div className={`${s.body} ${s.ellipse}`} data-body="unselected-body" data-kind="ellipse">
            ellipse
          </div>
          <span className={s.padNote}>
            {engaged ? 'engaged — mid-drag' : 'initial'} · mod = {IS_MAC ? 'meta' : 'ctrl'}
          </span>
        </div>

        <table className={s.table}>
          <thead>
            <tr><th>spec</th><th>last event</th></tr>
          </thead>
          <tbody>
            {SPECS.map((spec, i) => {
              const hit = latest?.matched.includes(i) ?? false;
              return (
                <tr key={i} className={hit ? s.hit : undefined}>
                  <td className={s.code}>{specText(spec)}</td>
                  <td className={s.mark}>{latest ? (hit ? 'match' : '—') : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ol className={s.log}>
          {log.map((l) => (
            <li key={l.n}>
              <span className={s.num}>{String(l.n).padStart(3)}</span>
              <span className={s.code}>{summarize(l.event)}</span>
              <span className={s.muted}>
                {l.engaged ? ' · engaged' : ''} · {l.matched.length} matched
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ParsedView({ parsed }: { parsed: ParsedRoute }) {
  const desc = getGestureDescriptor(parsed.gesture);
  const mods = Object.entries(parsed.modifiers).map(([k, v]) => `${k}: ${v}`);
  const rows: [keyof typeof ROUTE_FIELD_DEFINITIONS, string][] = [
    ['phases', parsed.phases.map((a) => `${formatPhaseAtom(a)}  (channel ${a.channel}, phase ${a.phase})`).join(' | ')],
    ['gesture', parsed.gesture],
    [
      'arg',
      desc.arg
        ? `${parsed.arg ?? '—'}  (${desc.arg.name}: ${desc.arg.values === 'free' ? 'any string' : desc.arg.values.join(' | ')})`
        : 'no arg slot',
    ],
    ['target', desc.hasTarget ? parsed.target ?? '—' : 'no target slot'],
    ['modifiers', mods.length ? mods.join(', ') : 'none held; anything unlisted must not be'],
  ];
  return (
    <>
      <table className={s.table}>
        <tbody>
          {rows.map(([field, value]) => (
            <tr key={field}>
              <th scope="row" title={ROUTE_FIELD_DEFINITIONS[field]}>{field}</th>
              <td className={s.code}>{value}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">canonical</th>
            <td className={s.code}>{formatRoute(parsed)}</td>
          </tr>
        </tbody>
      </table>
      <p className={s.prose}>
        {describeRouteParts(parsed).map((part, i) =>
          typeof part === 'string'
            ? part
            : <abbr key={i} title={part.definition}>{part.label}</abbr>,
        )}
      </p>
    </>
  );
}
