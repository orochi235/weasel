/**
 * Paths that are no node, drawn over the scene: a region a tool would take,
 * the result an operation would make before it is applied.
 */
import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { CommandPaint } from '@weasel-js/paint';
import { commandFill, commandStroke, type DrawCommand } from '@weasel-js/renderer';
import type { OverlayRole } from '@weasel-js/routing';
import { createEmitter } from '@weasel-js/registry';
import type { RenderLayer } from 'core/layers/render';
import type { PathPaint } from './nodeShapes/nodePaint';

/** One path to draw, in world coordinates, and what it is. */
export interface TransientPath {
  path: Path;
  /** Omitted reads as `'chrome'`. */
  role?: OverlayRole;
  /** Paint the path wears, drawn in place of the role's fill and under the
   *  role's outline: a result shown as it will look once made. */
  paint?: PathPaint;
}

/** How one role reads. The stroke is one screen pixel wide at any zoom. */
export interface PathOverlayStyle {
  fill?: CommandPaint;
  stroke?: CommandPaint;
}

/**
 * The kit's roles: `'chrome'` for a path shown for reference, `'picked'` for
 * one a gesture has taken, and `'remove'` for one it would delete.
 */
export const PATH_OVERLAY_ROLES: Readonly<Record<string, PathOverlayStyle>> = {
  chrome: { fill: { color: 'rgba(164, 139, 212, 0.18)' }, stroke: { color: '#a48bd4' } },
  picked: { fill: { color: 'rgba(164, 139, 212, 0.45)' }, stroke: { color: '#7d5fc0' } },
  remove: { fill: { color: 'rgba(226, 59, 59, 0.35)' }, stroke: { color: '#e23b3b' } },
};

/** The paths an overlay holds, and the layer that draws them. */
export interface PathOverlay {
  get(): readonly TransientPath[];
  /** Replace every path. */
  set(paths: readonly TransientPath[]): void;
  clear(): void;
  /** A world-space layer drawing the paths in order, repainting on each change. */
  layer: RenderLayer<unknown>;
}

/** Options for {@link createPathOverlay}. */
export interface PathOverlayOptions {
  /** The layer's id; see `RenderLayer.id`. */
  id: string;
  label?: string;
  /** Styles per role, merged over {@link PATH_OVERLAY_ROLES}. A role with
   *  none paints as `'chrome'`. */
  roles?: Readonly<Record<string, PathOverlayStyle>>;
}

/** A store of transient paths and the layer that draws it; hand the layer to
 *  a tool's `overlay` or a canvas's `layers`. */
export function createPathOverlay({ id, label = 'Transient paths', roles }: PathOverlayOptions): PathOverlay {
  const styles = { ...PATH_OVERLAY_ROLES, ...roles };
  const changed = createEmitter();
  let current: readonly TransientPath[] = [];
  const set = (paths: readonly TransientPath[]): void => {
    if (paths.length === 0 && current.length === 0) return;
    current = paths;
    changed.emit();
  };
  return {
    get: () => current,
    set,
    clear: () => set([]),
    layer: {
      id,
      label,
      space: 'world',
      subscribe: changed.subscribe,
      draw: () =>
        current.flatMap(({ path, role = 'chrome', paint }): DrawCommand[] => {
          const style = styles[role] ?? styles['chrome']!;
          const outline = style.stroke ? { stroke: { paint: style.stroke, width: { px: 1 } } } : {};
          if (!paint) return [{ kind: 'path', path, ...(style.fill ? { fill: { paint: style.fill } } : {}), ...outline }];
          const box = boundsOfPath(path);
          const fill = paint.fill && commandFill(paint.fill, box);
          const stroke = paint.stroke && commandStroke(paint.stroke, box);
          return [
            { kind: 'path', path, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) },
            ...(style.stroke ? [{ kind: 'path', path, ...outline } as DrawCommand] : []),
          ];
        }),
    },
  };
}
