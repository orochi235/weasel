/**
 * Drawing stencils: one tool per stencil, each a declarative shell binding a
 * drag to core's `insert` action, and the `insert` dep that builds the body.
 */
import { useMemo } from 'react';
import {
  commitOps, defineTool, useDepRegistry, useDepSource, useLatest, INSERT_REPOSITION_BINDING,
  type ActionDeps, type InsertDep, type NodeId, type Tool,
} from '@weasel-js/core';
import type { MeasureRowText } from './body';
import type { NodeStyle } from './fromData';
import { stencilBuild, stencilIdOf, stencilKind, type DiagramStencil } from './stencil';

/** The tool that draws `stencil`: its id is the stencil's insert kind. */
export function stencilTool(stencil: DiagramStencil): Tool {
  return defineTool({
    id: stencilKind(stencil.id),
    hookName: 'useStencilTool',
    capabilities: ['creates-shapes'],
    cursor: 'crosshair',
    presentation: { label: stencil.label, group: 'stencil' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: stencilKind(stencil.id) } } },
      INSERT_REPOSITION_BINDING,
    ],
  });
}

/** {@link stencilTool}, rebuilt only when the stencil changes. */
export function useStencilTool(stencil: DiagramStencil): Tool {
  return useMemo(() => stencilTool(stencil), [stencil]);
}

/** Options for {@link useStencilInsert}. */
export interface StencilInsertOptions {
  /** The layer bodies are inserted on. Default: the scene's first layer. */
  layer?: string;
  measure?: MeasureRowText;
  /** The body's fill, stroke and text colors. Default `diagramScene`'s node style. */
  style?: NodeStyle;
}

/**
 * Registers the `insert` dep for stencil kinds, replacing the kit's default.
 * A kind no stencil here names inserts nothing: the dep registry answers only
 * its newest source, so the default cannot be reached to delegate to.
 */
export function useStencilInsert(stencils: readonly DiagramStencil[], opts: StencilInsertOptions = {}): void {
  const registry = useDepRegistry();
  const stencilsRef = useLatest(stencils);
  const optsRef = useLatest(opts);

  useDepSource('insert', (): InsertDep => {
    const scene = registry.get('scene');
    const layer = () => optsRef.current.layer ?? scene?.layers[0]?.id ?? 'default';
    const build: NonNullable<InsertDep['build']> = (bounds, extras) => {
      const id = stencilIdOf(extras.kind);
      const stencil = id === null ? undefined : stencilsRef.current.find((s) => s.id === id);
      if (stencil === undefined || scene === undefined) return null;
      const built = stencilBuild(stencil, bounds, {
        layer: layer(),
        newId: () => scene.mintId(),
        ...(optsRef.current.measure ? { measure: optsRef.current.measure } : {}),
        ...(optsRef.current.style ? { style: optsRef.current.style } : {}),
      });
      return { id: built.id as NodeId, ops: built.ops };
    };
    return {
      layer,
      build,
      commit(bounds, extras, ends) {
        const built = build(bounds, extras, ends);
        if (built === null) return null;
        const deps = { scene, applyOps: registry.get('applyOps'), selection: registry.get('selection') };
        commitOps(deps as unknown as ActionDeps, built.ops, `Insert ${extras.kind}`);
        return built.id;
      },
    };
  });
}
