import type { ModeRegistry } from './registry';

/** Loose draw-command type — the kit's `DrawCommand` union shape is over in
 *  `src/renderer`. We keep this opaque to avoid a cross-package import in
 *  the type surface; consumers cast to the real DrawCommand at use site. */
export type ModeDrawCommand = unknown;

export type ModeDecorationPainter = () => ModeDrawCommand[];

export interface CreateModeDecorationsOptions {
  registry: ModeRegistry;
}

export interface ModeDecorations {
  /** Register (or replace) the painter for a mode id. */
  register(modeId: string, painter: ModeDecorationPainter): void;
  /** Paint the active mode's decorations. Returns an empty array if no
   *  painter is registered for the active mode. */
  paint(): ModeDrawCommand[];
  /** Monotonic version. Bumps on mode change or painter registration. */
  getVersion(): number;
}

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
