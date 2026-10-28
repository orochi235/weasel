import type { Tool, ToolsApi } from '@weasel-js/core';
import {
  DIAGRAM_ITEM_CARRY, STENCIL_GROUPS, addStencilGroup, diagramTypeDocOf, groupStencilIds, removeStencilGroup, stencilIdOf, type StencilGroup,
} from '@weasel-js/diagram';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useMemo, useState, type ReactElement } from 'react';
import type { ChartScene } from './chartDocument';

/** A stencil's tool, which the Shapes panel holds rather than the main palette. */
export const isStencilTool = (tool: Tool): boolean => stencilIdOf(tool.id) !== null;

/** A stencil's button carries its stencil id onto the canvas. */
const carryStencil = (tool: Tool) => {
  const id = stencilIdOf(tool.id);
  return id === null ? null : { type: DIAGRAM_ITEM_CARRY, value: id };
};

function GroupPanel({ group, tools }: { group: StencilGroup; tools: ToolsApi }): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const include = useMemo(() => {
    const ids = new Set(groupStencilIds(group));
    return (tool: Tool) => ids.has(stencilIdOf(tool.id) ?? '');
  }, [group]);
  return (
    <SidebarPanel title={group.label} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)}>
      <ToolPalette tools={tools} include={include} columns={3} ariaLabel={group.label} carryTool={carryStencil} />
    </SidebarPanel>
  );
}

/** The Shapes panels: one per stencil group the chart shows, in its order, and More shapes, which shows or hides a
 *  group. A button picks that stencil's tool, and dragging one onto the canvas drops one. */
export function StencilPanel({ tools, scene }: { tools: ToolsApi; scene: ChartScene }): ReactElement {
  const shown = diagramTypeDocOf(scene).groups;
  const items = Object.values(STENCIL_GROUPS).map((g) => ({ value: g.id, label: g.label, checked: shown.includes(g.id) }));
  const toggle = (id: string) => (shown.includes(id) ? removeStencilGroup : addStencilGroup)(scene, id);
  return (
    <>
      <MenuButton label="More shapes" items={items} onAction={toggle} />
      {shown.flatMap((id) => {
        const group = STENCIL_GROUPS[id];
        return group ? [<GroupPanel key={id} group={group} tools={tools} />] : [];
      })}
    </>
  );
}
