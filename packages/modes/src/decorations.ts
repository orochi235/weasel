import type { ModeRegistry } from './registry';

/** Loose draw-command type — the kit's `DrawCommand` union shape is over in
 *  `src/renderer`. We keep this opaque to avoid a cross-package import in
 *  the type surface; consumers cast to the real DrawCommand at use site. */
export type ModeDrawCommand = unknown;

/** Produces the draw commands for one mode's persistent decorations. Called
 *  once per paint while that mode is active. */
export type ModeDecorationPainter = () => ModeDrawCommand[];

/** Options for `createModeDecorations`. */
export interface CreateModeDecorationsOptions {
  registry: ModeRegistry;
}

/** Per-mode decoration painters, keyed by mode id. Mode decorations are drawn
 *  for as long as the mode is active and belong to the mode rather than to any
 *  tool — path-edit's anchor dots and handle lines are the motivating case. */
export interface ModeDecorations {
  /** Register (or replace) the painter for a mode id. */
  register(modeId: string, painter: ModeDecorationPainter): void;
  /** Paint the active mode's decorations. Returns an empty array if no
   *  painter is registered for the active mode. */
  paint(): ModeDrawCommand[];
  /** Monotonic version. Bumps on mode change or painter registration. */
  getVersion(): number;
}

/** Build a decoration registry bound to a mode registry, so switching modes
 *  switches which painter runs. */
export function createModeDecorations(opts: CreateModeDecorationsOptions): ModeDecorations {
  const { registry } = opts;
  const painters = new Map<string, ModeDecorationPainter>();
  let ver = 0;

  registry.subscribe(() => {
    ver++;
  });

  return {
    register(modeId: string, painter: ModeDecorationPainter): void {
      painters.set(modeId, painter);
      ver++;
    },
    paint(): ModeDrawCommand[] {
      const painter = painters.get(registry.current().id);
      if (!painter) return [];
      return painter();
    },
    getVersion: () => ver,
  };
}
