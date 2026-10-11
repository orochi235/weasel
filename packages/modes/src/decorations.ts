import { createEmitter } from '@weasel-js/registry';
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
  /** Register (or replace) the painter for a mode id. Returns a release that
   *  removes it, and does nothing once another painter has replaced it. */
  register(modeId: string, painter: ModeDecorationPainter): () => void;
  /** Paint the active mode's decorations. Returns an empty array if no
   *  painter is registered for the active mode. */
  paint(): ModeDrawCommand[];
  /** Monotonic version. Bumps on mode change, painter registration, or release. */
  getVersion(): number;
  /** Notified whenever `getVersion` bumps — what a canvas repaints on. */
  subscribe(listener: () => void): () => void;
}

/** Build a decoration registry bound to a mode registry, so switching modes
 *  switches which painter runs. */
export function createModeDecorations(opts: CreateModeDecorationsOptions): ModeDecorations {
  const { registry } = opts;
  const painters = new Map<string, ModeDecorationPainter>();
  const listeners = createEmitter();
  let registrations = 0;
  const changed = (): void => {
    registrations++;
    listeners.emit();
  };

  return {
    register(modeId: string, painter: ModeDecorationPainter): () => void {
      painters.set(modeId, painter);
      changed();
      return () => {
        if (painters.get(modeId) !== painter) return;
        painters.delete(modeId);
        changed();
      };
    },
    paint(): ModeDrawCommand[] {
      const painter = painters.get(registry.current().id);
      if (!painter) return [];
      return painter();
    },
    getVersion: () => registry.getVersion() + registrations,
    subscribe(listener: () => void): () => void {
      const off = listeners.subscribe(listener);
      const offMode = registry.subscribe(listener);
      return () => {
        off();
        offMode();
      };
    },
  };
}
