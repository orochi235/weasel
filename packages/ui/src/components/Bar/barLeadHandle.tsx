import type { HTMLAttributes, ReactNode } from 'react';
import { DragGrip } from '../DragGrip';
import { useDockHandle } from '../ToolbarDock/dockContext';
import { BAR_LEAD } from './useBarOverflow';

/** The lead a bar draws: the attributes for its span, and what the span holds. */
export interface BarLeadDraw {
  attrs: HTMLAttributes<HTMLElement>;
  content: ReactNode;
  /** True where the lead is a dock's handle for moving the bar. */
  handle: boolean;
}

/**
 * What a bar starts its line with, given what its `lead` names. Inside a movable `ToolbarDock` the lead is the
 * bar's handle: its name, which drags it, or a grip alone for a bar with no name. Elsewhere it is
 * hidden from assistive tech, and absent when there is nothing to show. A bar that calls this takes the dock's handle
 * for itself, so it wraps what it draws in `DockBarContext` set to null: a bar inside it, in a popover or a
 * menu, is not the dock's bar and grows no handle.
 */
export function useBarLead(leading: ReactNode): BarLeadDraw | null {
  const handle = useDockHandle();
  const mark = { [BAR_LEAD]: '' } as HTMLAttributes<HTMLElement>;
  if (handle) {
    const named = leading != null && leading !== '';
    return { attrs: { ...handle.props, ...mark }, content: named ? leading : <DragGrip />, handle: true };
  }
  if (leading == null || leading === '') return null;
  return { attrs: { 'aria-hidden': true, ...mark }, content: leading, handle: false };
}
