import type { Tool, ToolsApi } from '@weasel-js/core';
import { stencilIdOf } from '@weasel-js/diagram';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import type { DragEvent, ReactElement } from 'react';
import { STENCIL_MIME } from './stencilDrop';

/** A stencil's tool, which the Shapes panel holds rather than the main palette. */
export const isStencilTool = (tool: Tool): boolean => stencilIdOf(tool.id) !== null;

const onDragStart = (tool: Tool, e: DragEvent<HTMLButtonElement>): void => {
  e.dataTransfer.setData(STENCIL_MIME, stencilIdOf(tool.id)!);
  e.dataTransfer.effectAllowed = 'copy';
};

/** The shapes palette: a button picks that stencil's tool, and dragging one onto the canvas drops one. */
export function StencilPanel({ tools }: { tools: ToolsApi }): ReactElement {
  return (
    <SidebarPanel title="Shapes">
      <ToolPalette tools={tools} include={isStencilTool} columns={3} ariaLabel="Shapes" onToolDragStart={onDragStart} />
    </SidebarPanel>
  );
}
