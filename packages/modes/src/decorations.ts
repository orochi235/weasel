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
  /** Register a painter for a mode id, which must be one of the registry's
   *  modes. The newest registration for a mode paints. Returns a release that
   *  removes this registration: releasing the live one brings back the one
   *  beneath it, and releasing a buried one removes only it. */
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
  // Each registration is its own entry, so a release can tell its painter from another
  // registration of the same function. Newest last.
  const painters = new Map<string, { painter: ModeDecorationPainter }[]>();
  const listeners = createEmitter();
  // One relay of the registry's changes for every listener, so a listener this shares with the registry, or with
  // another of its readers, keeps its subscription there when it leaves here.
  const relay = (): void => { listeners.emit(); };
  let offMode: (() => void) | null = null;
  let registrations = 0;
  const changed = (): void => {
    registrations++;
    listeners.emit();
  };

  return {
    register(modeId: string, painter: ModeDecorationPainter): () => void {
      registry.byId(modeId);
      const entry = { painter };
      const stack = painters.get(modeId) ?? [];
      stack.push(entry);
      painters.set(modeId, stack);
      changed();
      return () => {
        const i = stack.indexOf(entry);
        if (i === -1) return;
        stack.splice(i, 1);
        if (stack.length === 0 && painters.get(modeId) === stack) painters.delete(modeId);
        changed();
      };
    },
    paint(): ModeDrawCommand[] {
      const entry = painters.get(registry.current().id)?.at(-1);
      return entry ? entry.painter() : [];
    },
    getVersion: () => registry.getVersion() + registrations,
    subscribe(listener: () => void): () => void {
      const off = listeners.subscribe(listener);
      offMode ??= registry.subscribe(relay);
      return () => {
        off();
        if (listeners.size === 0) {
          offMode?.();
          offMode = null;
        }
      };
    },
  };
}
