import type { Tool, ToolsApi } from '@weasel-js/core';
import {
  DIAGRAM_ITEM_CARRY, STENCIL_GROUPS, StencilGhost, addStencilGroup, diagramTypeDocOf, groupStencilIds, removeStencilGroup,
  roleStyle, stencilIdOf, type DiagramTheme, type StencilGroup,
} from '@weasel-js/diagram';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { ChartScene } from './chartDocument';

/** A stencil's tool, which the Shapes panel holds rather than the main palette. */
export const isStencilTool = (tool: Tool): boolean => stencilIdOf(tool.id) !== null;

/** A stencil's button carries its stencil id onto the canvas. */
const carryStencil = (tool: Tool) => {
  const id = stencilIdOf(tool.id);
  return id === null ? null : { type: DIAGRAM_ITEM_CARRY, value: id };
};

/** What the Shapes panel draws a carried stencil with: the chart's theme, at the canvas's zoom. */
interface GhostLook {
  theme: DiagramTheme;
  scale: number;
}

function GroupPanel({ group, tools, look }: { group: StencilGroup; tools: ToolsApi; look: GhostLook }): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const include = useMemo(() => {
    const ids = new Set(groupStencilIds(group));
    return (tool: Tool) => ids.has(stencilIdOf(tool.id) ?? '');
  }, [group]);
  const ghost = (tool: Tool): ReactNode => {
    const stencil = group.stencils.find((s) => s.id === stencilIdOf(tool.id));
    if (stencil === undefined) return null;
    const style = 'outline' in stencil ? roleStyle(look.theme) : look.theme.container;
    return <StencilGhost stencil={stencil} style={style} scale={look.scale} />;
  };
  return (
    <SidebarPanel title={group.label} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)}>
      <ToolPalette
        tools={tools} include={include} columns={3} ariaLabel={group.label} carryTool={carryStencil} carryGhost={ghost}
      />
    </SidebarPanel>
  );
}

/** The Shapes panels: one per stencil group the chart shows, in its order, and More shapes, which shows or hides a
 *  group. A button picks that stencil's tool, and dragging one onto the canvas drops one, the shape itself following
 *  the pointer at the size it lands at `scale`. */
export function StencilPanel({ tools, scene, theme, scale }: {
  tools: ToolsApi;
  scene: ChartScene;
  theme: DiagramTheme;
  scale: number;
}): ReactElement {
  const shown = diagramTypeDocOf(scene).groups;
  const items = Object.values(STENCIL_GROUPS).map((g) => ({ value: g.id, label: g.label, checked: shown.includes(g.id) }));
  const toggle = (id: string) => (shown.includes(id) ? removeStencilGroup : addStencilGroup)(scene, id);
  const look = { theme, scale };
  return (
    <>
      <MenuButton label="More shapes" items={items} onAction={toggle} />
      {shown.flatMap((id) => {
        const group = STENCIL_GROUPS[id];
        return group ? [<GroupPanel key={id} group={group} tools={tools} look={look} />] : [];
      })}
    </>
  );
}
