import type { ToolCtx, ToolPresentation } from '../types';
import type { KeyBinding } from '../../interactions/actions/useKeybinding';
import type { RenderLayer } from '../../core/layers/render';
import type { Result } from './result';
import type { ModifierKey } from './modifiers';

export type ActionFn<TScratch> = (ctx: ToolCtx<TScratch>) => Result<TScratch>;

export type ModifierRoute<TScratch> = Partial<Record<ModifierKey, ActionFn<TScratch>>>;

export type RouteEntry<TScratch> = ActionFn<TScratch> | ModifierRoute<TScratch>;

export type RouteTable<TScratch> = Partial<Record<string, RouteEntry<TScratch>>>;

export interface PhaseDef<TScratch> {
  click?:   RouteTable<TScratch>;
  dblTap?:  RouteTable<TScratch>;
  drag?:    RouteTable<TScratch> | ActionFn<TScratch>;
  wheel?:   ActionFn<TScratch>;
  keyDown?: Record<string, ActionFn<TScratch>>;
  keyUp?:   Record<string, ActionFn<TScratch>>;
  cursor?:  string | ((ctx: ToolCtx<TScratch>) => string);
  overlay?: (ctx: ToolCtx<TScratch>) => RenderLayer<unknown>;
  claimsAll?: boolean;
}

export interface ToolDef<TScratch = void> {
  id: string;
  presentation?: ToolPresentation<TScratch>;
  keybinding?: KeyBinding;
  onActivate?:   (ctx: ToolCtx<TScratch>) => void;
  onDeactivate?: (ctx: ToolCtx<TScratch>) => void;
  cursor?: string | ((ctx: ToolCtx<TScratch>) => string);
  initial: PhaseDef<TScratch>;
  engaged?: PhaseDef<TScratch>;
}

/** Viewport-tool spec — strict subset of ToolDef. Drops click/dblTap,
 *  narrows drag to plain ActionFn. Mechanically derived via Pick/Omit
 *  so the subset relationship is compiler-enforced. */
export type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'keyUp' | 'cursor' | 'overlay' | 'claimsAll'
> & {
  drag?: ActionFn<TScratch>;
};

export type ViewportToolDef<TScratch = void> = Omit<
  ToolDef<TScratch>, 'initial' | 'engaged'
> & {
  initial: ViewportPhaseDef<TScratch>;
  engaged?: ViewportPhaseDef<TScratch>;
};
