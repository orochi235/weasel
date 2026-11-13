/**
 * Every tool this package ships, as sets: the connector, one set per stencil
 * group, and the sequence tools, with the hook that builds them all.
 */
import { useMemo } from 'react';
import { toolSet, type Tool, type ToolSet } from '@weasel-js/core';
import type { ConnectActionOptions } from './connect';
import { CONNECTOR_TOOL_ID, useConnectorTool } from './connectorTool';
import { STENCIL_GROUPS } from './diagramTypes/catalog';
import type { StencilGroup } from './diagramTypes/types';
import { stencilKind, type DiagramStencil } from './stencil';
import { stencilTool } from './stencilTool';
import { SEQUENCE_TOOLS, useSequenceTools, type SequenceToolsOptions } from './sequence/tools';

type Stencil = Pick<DiagramStencil, 'id' | 'label' | 'description' | 'icon'>;

/** Each stencil's tool, keyed by its id (the stencil's insert kind). */
export function stencilTools(stencils: readonly Stencil[]): Record<string, Tool> {
  return Object.fromEntries(stencils.map((s) => [stencilKind(s.id), stencilTool(s)]));
}

/** The tools of `group`'s stencils, as a set named for the group. */
export function stencilToolSet(group: StencilGroup): ToolSet {
  return toolSet(group.id, group.stencils.map((s) => stencilKind(s.id)), { label: group.label });
}

/** One set per shipped stencil group, in menu order. */
export const STENCIL_TOOLS: ToolSet = toolSet('stencils', Object.values(STENCIL_GROUPS).map(stencilToolSet), { label: 'Stencils' });

/** Every tool `@weasel-js/diagram` ships: the connector, the stencils, and the sequence tools. */
export const DIAGRAM_TOOLS: ToolSet = toolSet('diagram', [CONNECTOR_TOOL_ID, STENCIL_TOOLS, SEQUENCE_TOOLS], { label: 'Diagram' });

/** Options for {@link useDiagramTools}. */
export interface UseDiagramToolsOptions<TPose> {
  /** What the connector joins and how: `useConnectorTool`'s options. */
  connector: ConnectActionOptions<TPose>;
  /** The stencils to give tools to. Default every shipped group's. Keep it stable across renders. */
  stencils?: readonly Stencil[];
  /** `useSequenceTools`'s options. */
  sequence?: SequenceToolsOptions;
}

const SHIPPED_STENCILS: readonly Stencil[] = Object.values(STENCIL_GROUPS).flatMap((g) => g.stencils);

/**
 * Every tool in {@link DIAGRAM_TOOLS}, keyed by id, for `<SceneCanvas tools>`: the connector, a tool per stencil, and
 * the sequence tools. The stencils draw through core's `insert` action, so mount `useStencilInsert` beside them.
 */
export function useDiagramTools<TPose>(options: UseDiagramToolsOptions<TPose>): Record<string, Tool> {
  const { stencils = SHIPPED_STENCILS } = options;
  const connector = useConnectorTool(options.connector);
  const sequence = useSequenceTools(options.sequence);
  const shapes = useMemo(() => stencilTools(stencils), [stencils]);
  return useMemo(() => ({ [CONNECTOR_TOOL_ID]: connector, ...shapes, ...sequence }), [connector, shapes, sequence]);
}
