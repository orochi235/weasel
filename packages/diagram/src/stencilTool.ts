/**
 * Drawing stencils: one tool per stencil, each a declarative shell binding a
 * drag to core's `insert` action, and the `insert` dep that builds the body.
 */
import { useMemo } from 'react';
import {
  commitOps, defineTool, useDepRegistry, useDepSource, useLatest, INSERT_REPOSITION_BINDING,
  type ActionDeps, type InsertDep, type NodeId, type Op, type Tool,
} from '@weasel-js/core';
import type { MeasureRowText } from './body';
import { diagramDropParentAt, type DropParentScene } from './containers/canDropInto';
import { containerBuild, type ContainerStencil } from './containers/containerStencils';
import type { NodeStyle } from './fromData';
import { stencilBuild, stencilIdOf, stencilKind, type DiagramStencil } from './stencil';

/** The tool that draws `stencil`, a shape's or a container's: its id is the stencil's insert kind. */
export function stencilTool(stencil: Pick<DiagramStencil, 'id' | 'label' | 'icon'>): Tool {
  return defineTool({
    id: stencilKind(stencil.id),
    hookName: 'useStencilTool',
    capabilities: ['creates-shapes'],
    cursor: 'crosshair',
    presentation: { label: stencil.label, icon: stencil.icon, group: 'stencil' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: stencilKind(stencil.id) } } },
      INSERT_REPOSITION_BINDING,
    ],
  });
}

/** {@link stencilTool}, rebuilt only when the stencil changes. */
export function useStencilTool(stencil: Pick<DiagramStencil, 'id' | 'label' | 'icon'>): Tool {
  return useMemo(() => stencilTool(stencil), [stencil]);
}

/** Options for {@link useStencilInsert}. */
export interface StencilInsertOptions {
  /** The layer bodies are inserted on. Default: the scene's first layer. */
  layer?: string;
  measure?: MeasureRowText;
  /** The body's fill, stroke and text colors. Default `diagramScene`'s node style. */
  style?: NodeStyle;
  /** Container stencils to draw beside the shapes (`CONTAINER_STENCILS`). */
  containers?: readonly ContainerStencil[];
}

type Bounds = { x: number; y: number; width: number; height: number };

/**
 * Registers the `insert` dep for stencil kinds. Any other kind goes to the
 * `insert` dep this one displaced, so core's rect, ellipse and text tools
 * keep working beside the stencils. A stencil drawn inside a container or a
 * lane becomes its member (`diagramDropParentAt`).
 */
export function useStencilInsert(stencils: readonly DiagramStencil[], opts: StencilInsertOptions = {}): void {
  const registry = useDepRegistry();
  const stencilsRef = useLatest(stencils);
  const optsRef = useLatest(opts);

  useDepSource('insert', (below): InsertDep => {
    const scene = registry.get('scene');
    const fallback = below();
    const layer = () => optsRef.current.layer ?? fallback?.layer?.() ?? scene?.layers[0]?.id ?? 'default';
    const stencilOf = (kind: string): DiagramStencil | ContainerStencil | undefined => {
      const id = stencilIdOf(kind);
      if (id === null) return undefined;
      return stencilsRef.current.find((s) => s.id === id) ?? optsRef.current.containers?.find((s) => s.id === id);
    };
    const builtAt = (stencil: DiagramStencil | ContainerStencil, bounds: Bounds): { id: string; ops: Op[] } | null => {
      if (scene === undefined) return null;
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const role = 'role' in stencil ? stencil.role : null;
      const { style, measure } = optsRef.current;
      const common = {
        layer: layer(),
        newId: () => scene.mintId() as string,
        parent: diagramDropParentAt(scene as unknown as DropParentScene, center, role),
        ...(style ? { style } : {}),
      };
      return 'role' in stencil
        ? containerBuild(stencil, bounds, common)
        : stencilBuild(stencil, bounds, { ...common, ...(measure ? { measure } : {}) });
    };
    const build: NonNullable<InsertDep['build']> = (bounds, extras, ends) => {
      const stencil = stencilOf(extras.kind);
      if (stencil === undefined) return fallback?.build?.(bounds, extras, ends) ?? null;
      const built = builtAt(stencil, bounds);
      return built === null ? null : { id: built.id as NodeId, ops: built.ops };
    };
    return {
      layer,
      build,
      commit(bounds, extras, ends) {
        const stencil = stencilOf(extras.kind);
        if (stencil === undefined) return fallback?.commit(bounds, extras, ends) ?? null;
        const built = build(bounds, extras, ends);
        if (built === null) return null;
        const deps = { scene, applyOps: registry.get('applyOps'), selection: registry.get('selection') };
        commitOps(deps as unknown as ActionDeps, built.ops, `Insert ${stencil.label}`);
        return built.id;
      },
    };
  });
}
