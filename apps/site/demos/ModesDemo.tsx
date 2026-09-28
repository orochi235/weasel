import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  useScene,
  textCommandFromRuns,
  solid,
  modeDecorationLayer,
  workspaceTintLayer,
  type DrawCommand,
  type ToolsApi,
} from '@weasel-js/core';
import {
  ALL_TAGS,
  IMPLICIT_TAGS,
  createModeDecorations,
  createModeRegistry,
  createScopingDim,
  getActiveModeFor,
  modeLabel,
  type ModeDefinition,
} from '@weasel-js/modes';
import { modeShortcuts } from '@weasel-js/routing';
import { ToolPalette } from '@weasel-js/ui';
import styles from './ModesDemo.module.css';

const W = 620, H = 340;

interface Shape { id: string; x: number; y: number; width: number; height: number; fill: { color: string }; label: string }

const SHAPES: Shape[] = [
  { id: 'a', x: 70,  y: 70,  width: 120, height: 90,  fill: { color: '#7fb069' }, label: 'a' },
  { id: 'b', x: 250, y: 110, width: 110, height: 110, fill: { color: '#d4a574' }, label: 'b' },
  { id: 'c', x: 420, y: 60,  width: 130, height: 80,  fill: { color: '#a48bd4' }, label: 'c' },
  { id: 'd', x: 400, y: 200, width: 90,  height: 80,  fill: { color: '#7ab8d4' }, label: 'd' },
];

const MODES: readonly ModeDefinition[] = [
  {
    id: 'draw',
    label: 'Draw',
    description: 'Draw shapes, select them, move and resize them.',
    kind: 'soft',
    allows: ['creates-selection', 'transforms-selection', 'creates-shapes'],
    scoping: false,
    entry: { shortcut: '1' },
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Work on the selected shape alone; everything else dims and ignores the pointer.',
    kind: 'soft',
    allows: ['creates-selection', 'transforms-selection'],
    scoping: true,
    workspace: { tint: '#8b5cf6', gradient: 'bottom-up', intensity: 0.22 },
    entry: { shortcut: '2' },
    exit: { shortcut: 'Escape' },
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Look, measure and pan, but change nothing.',
    kind: 'soft',
    allows: [],
    scoping: false,
    workspace: { tint: '#f59e0b', gradient: 'bottom-up', intensity: 0.22 },
    entry: { shortcut: '3' },
    exit: { shortcut: 'Escape' },
  },
];

type Rect = { x: number; y: number; width: number; height: number };

const ACCENT = '#8b5cf6';
const INK = '#5a4632';

/**
 * Three app-defined modes over one canvas. The registry is the only mode
 * state: the buttons, the number keys and Escape all call `setMode`, and every
 * consequence — which tools work, which chrome shows, what dims, what the
 * decoration layer paints — is read back from `registry.current()`.
 */
export function ModesDemo() {
  const scene = useScene({ items: SHAPES });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  const registry = useMemo(() => createModeRegistry({ modes: MODES, initial: 'draw' }), []);
  useSyncExternalStore(registry.subscribe, registry.getVersion);
  const mode = registry.current();

  const target = useRef<ReadonlySet<string>>(new Set());
  const scoping = useMemo(
    () => createScopingDim({ registry, getTargetIds: () => target.current }),
    [registry],
  );

  const enter = useCallback((id: string) => {
    if (id === 'focus') {
      const selected = scene.getSelection().map(String);
      target.current = new Set(selected.length > 0 ? selected : [SHAPES[1]!.id]);
      scoping.invalidate();
    }
    registry.setMode(id);
  }, [registry, scene, scoping]);

  const shortcuts = useMemo(
    () => [modeShortcuts(registry, { enter, exit: () => registry.setMode('draw') })],
    [registry, enter],
  );

  const getActiveMode = useMemo(() => getActiveModeFor(registry), [registry]);

  const decorations = useMemo(() => {
    const d = createModeDecorations({ registry });
    const boundsOf = (id: string) => scene.get(id as never)?.pose as Rect | undefined;
    d.register('focus', () => [...target.current].flatMap((id) => {
      const r = boundsOf(id);
      if (!r) return [];
      return [{
        kind: 'path',
        path: { kind: 'rect', x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 },
        stroke: { paint: solid(ACCENT), width: { px: 1.5 }, dash: [6, 4] },
      } satisfies DrawCommand];
    }));
    d.register('review', () => scene.nodesOnLayer('default').map((node) => {
      const r = node.pose as Rect;
      return textCommandFromRuns(
        r.x, r.y + r.height + 6,
        [{ text: `${Math.round(r.width)} × ${Math.round(r.height)}`, fill: solid(INK) }],
        { fontFamily: 'ui-monospace, monospace', fontSize: 11 },
      );
    }));
    return d;
  }, [registry, scene]);

  const decorationLayer = useMemo(() => modeDecorationLayer(decorations), [decorations]);
  const tintLayer = useMemo(() => workspaceTintLayer({ registry }), [registry]);
  const redrawOn = useMemo(() => [scoping], [scoping]);

  const allowed = new Set<string>(mode.allows);

  return (
    <div className={styles.demo}>
      <div className={styles.bar}>
        <div className={styles.modes} role="group" aria-label="Mode">
          {registry.list().map((m) => (
            <button
              key={m.id}
              type="button"
              className={`ckd-btn ${m.id === mode.id ? styles.active : ''}`}
              aria-pressed={m.id === mode.id}
              title={m.description}
              onClick={() => enter(m.id)}
            >
              {modeLabel(m)} <kbd className={styles.key}>{m.entry?.shortcut}</kbd>
            </button>
          ))}
        </div>
        {tools && <ToolPalette tools={tools} orientation="horizontal" modeRegistry={registry} />}
      </div>

      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        backgroundFill={{ color: '#ffffff' }}
        scene={scene}
        selectionMode="multi"
        features={['pick', 'move', 'transform']}
        defaultTools={['select', 'hand', 'rect', 'ellipse']}
        onToolsCreated={setTools}
        getActiveMode={getActiveMode}
        ambient={shortcuts}
        alphaFor={scoping.alphaFor}
        isPointerInteractive={scoping.isPointerInteractive}
        redrawOn={redrawOn}
        decorationLayer={decorationLayer}
        layers={{ modeTint: { layer: tintLayer, before: 'scene' } }}
      />

      <dl className={styles.readout}>
        <dt>Mode</dt>
        <dd>
          <strong>{modeLabel(mode)}</strong> — {mode.description}
          {mode.exit?.shortcut && <> Press <kbd className={styles.key}>{mode.exit.shortcut}</kbd> to leave.</>}
        </dd>
        <dt>Scoping</dt>
        <dd>{mode.scoping ? 'on — shapes outside the target dim and ignore the pointer' : 'off'}</dd>
        <dt>Allows</dt>
        <dd className={styles.tags}>
          {ALL_TAGS.map((tag) => {
            const implicit = IMPLICIT_TAGS.includes(tag);
            const on = implicit || allowed.has(tag);
            return (
              <span key={tag} className={`${styles.tag} ${on ? styles.on : ''}`}>
                {tag}{implicit && ' (implicit)'}
              </span>
            );
          })}
        </dd>
      </dl>
    </div>
  );
}
