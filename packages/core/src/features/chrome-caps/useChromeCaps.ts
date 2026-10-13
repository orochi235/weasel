/**
 * The rule context a surface's chrome-visibility rules and action eligibility
 * are evaluated against, and the hook that keeps one for `<SceneCanvas>`.
 */
import { useMemo } from 'react';
import type { ActiveMode } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';
import {
  buildRuleCtx,
  DEFAULT_ALLOWED_CAPABILITIES,
  type DeviceProfile,
  type ModifierState,
  type RuleCtx,
} from '@weasel-js/routing';
import type { NodeId } from '../../core/scene/types';
import { viewZoom, type View } from '../../core/viewport/view';
import { resolveVisibility } from './resolve';
import type { VisibilityRules } from './types';

/**
 * The part of a rule context that belongs to one view. Everything else a
 * `RuleCtx` carries — mode, capabilities, device, focus — is the surface's and
 * the same for every view drawn on it.
 */
export interface ViewRuleInputs {
  selection: readonly NodeId[];
  view: View;
  /** What that view's dispatcher currently has in flight. */
  action: { kind: string | null; id: string | null };
}

/** The part of a rule context that belongs to the surface. */
export interface SurfaceRuleInputs {
  focused: boolean;
  /** The modifier keys held. Absent means none, so `modifierHeld` never matches. */
  modifiers?: ModifierState | undefined;
  hover: NodeId | null;
  /** Absent on a surface with no mode registry, which behaves as normal mode. */
  mode: ActiveMode | undefined;
  /** Whether one node may be resized. Absent means every node may. */
  resizable: ((id: string) => boolean) | undefined;
  editingAnchors: boolean;
  device: DeviceProfile;
}

const NO_MODIFIERS = { alt: false, ctrl: false, meta: false, shift: false };

/** One view's rule context on a surface. */
export function surfaceRuleCtx(surface: SurfaceRuleInputs, view: ViewRuleInputs): RuleCtx {
  const { resizable } = surface;
  return buildRuleCtx({
    focused: surface.focused,
    selection: view.selection,
    multiActive: view.selection.length > 1,
    modifiers: surface.modifiers ?? NO_MODIFIERS,
    action: view.action,
    hover: surface.hover,
    zoom: viewZoom(view.view),
    mode: surface.mode?.id ?? 'normal',
    // An empty set would make every `capability:` rule false and hide the
    // chrome those rules gate.
    allowedCapabilities: surface.mode?.allowedCapabilities ?? DEFAULT_ALLOWED_CAPABILITIES,
    // Left undefined without a predicate, which `resizable:` reads as resizable.
    selectionResizable: resizable ? view.selection.every((id) => resizable(id)) : undefined,
    editingAnchors: surface.editingAnchors,
    device: surface.device,
  });
}

/** Where a surface's rule context comes from. Read at the moment a rule is
 *  evaluated, never at render. */
export interface ChromeCapsSource {
  /** The surface's rule table, over the kit defaults. */
  rules: VisibilityRules | undefined;
  /** The active mode. Absent when no mode registry is wired. */
  getMode: (() => ActiveMode) | undefined;
  /** Absent means the surface always counts as focused. */
  getFocused: (() => boolean) | undefined;
  getHover: () => NodeId | null;
  /** Absent means no modifier key ever counts as held. */
  getModifiers?: (() => ModifierState) | undefined;
  resizable: ((id: string) => boolean) | undefined;
  editingAnchors: () => boolean;
  device: DeviceProfile;
}

/**
 * A surface's chrome-caps answers for one view. The rules are surface-wide on
 * purpose — one consumer table, one set of kit defaults — but a rule keyed on
 * selection, camera or the in-flight action answers differently per view, so
 * the caller supplies that part and both the paint gate and the dispatcher's
 * eligibility filter read the same context.
 */
export interface ChromeCaps {
  /** `undefined` when the surface gates nothing: no mode registry is wired. */
  ruleCtx(inputs: ViewRuleInputs): RuleCtx | undefined;
  isVisible(inputs: ViewRuleInputs): (id: string) => boolean;
}

/** The chrome-caps answers for a surface. The object keeps its identity for
 *  the life of the component and reads `source` as of the last commit. */
export function useChromeCaps(source: ChromeCapsSource): ChromeCaps {
  const live = useLatest(source);
  return useMemo(() => {
    const build = (inputs: ViewRuleInputs): RuleCtx => {
      const now = live.current;
      return surfaceRuleCtx({
        focused: now.getFocused ? now.getFocused() : true,
        modifiers: now.getModifiers?.(),
        hover: now.getHover(),
        mode: now.getMode?.(),
        resizable: now.resizable,
        editingAnchors: now.editingAnchors(),
        device: now.device,
      }, inputs);
    };
    return {
      ruleCtx: (inputs) => (live.current.getMode ? build(inputs) : undefined),
      isVisible: (inputs) => resolveVisibility(live.current.rules, build(inputs)),
    };
  }, [live]);
}
