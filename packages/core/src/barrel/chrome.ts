/**
 * Part of the `@weasel-js/core` barrel. Selection, affordances, chrome visibility, and units.
 *
 * @packageDocumentation
 */

// ─── Selection state hook ───────────────────────────────────────────────────
export { useSelection } from '../core/selection/useSelection';
export type {
  SelectionApi,
  SelectionMode,
  SelectionExtendKey,
  UseSelectionOptions,
  SelectionStore,
} from '../core/selection/useSelection';

// --- Selection ambient context --------------------------------------------
export {
  SelectionContextProvider,
  SelectionContextProviderIfRoot,
  useSelectionContext,
  usePublishSelection,
} from '@weasel-js/routing/react';
export type { SelectionContextValue } from '@weasel-js/routing/react';

// ─── Units: pluggable physical-unit system ──────────────────────────────────
export {
  resolveUnit,
  formatUnit,
  unitScale,
  ANGLE_RADIANS,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
  parseUnitExpr,
  resolveUnitExpr,
  axisUnits,
  formatAxes,
  resolveAxes,
  formatScoped,
  fromRoot,
  resolveScoped,
  scopesOf,
  toRoot,
} from '@weasel-js/quantity';
export type { Unit, UnitEntry, UnitScale, UnitSystem, UnitValue } from '@weasel-js/quantity';
export type { PerAxis, PlaneUnits, PlaneValue, UnitExpr, UnitExprContext } from '@weasel-js/quantity';
export type { ScopeTree, UnitScope } from '@weasel-js/quantity';

// ─── Affordances: cross-tool hittable chrome (resize/rotate handles) ────────
export {
  composeAffordanceLayer,
  hitAffordanceRegions,
  annulusSemiAxes,
  pointRegionFrame,
  createCornerResizeAffordance,
  createRotationAffordance,
  createPathAnchorAffordances,
  PATH_ANCHOR_CHROME_ID,
  type Affordance,
  type AffordanceBinding,
  type AffordanceRegion,
  type AffordanceRegionHit,
  type AnchorScratch,
  type AnchorState,
  type CommonAffordanceScratch,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
  type CustomPaintContext,
  type LayerHit,
  type PathAnchorAffordanceOptions,
  type RotationAffordanceOptions,
  type RotationScratch,
  type TargetTransform,
} from '../affordances';
export type { ClaimableGesture } from '@weasel-js/gestures';
export type { ChromeState } from '../core/selection/chromeState';
export { paintsLayer } from '../core/selection/chromeState';

// ─── chrome-caps: declarative chrome-visibility rules ──────────────────────
export {
  cond,
  when,
  and,
  or,
  not,
  always,
  never,
  focused,
  gesturing,
  editingAnchors,
  actionIs,
  selectionEmpty,
  selectionIs,
  selectionAtLeast,
  multiActive,
  hovering,
  hoveringSelected,
  modifierHeld,
  zoomAtLeast,
  canHover,
  coarsePointer,
  modeIs,
  modeIn,
  modeNot,
  capabilityIs,
  capabilityIn,
  capabilityAll,
  capabilityNot,
  evaluate,
  describeRule,
  ALWAYS,
  NEVER,
  buildRuleCtx,
  DEFAULT_ALLOWED_CAPABILITIES,
  defaultVisibilityRules,
  resolveVisibility,
  buildChromeCtx,
  useHoverTracking,
} from '../features/chrome-caps';
export type {
  ChromeCtx,
  ChromeId,
  Condition,
  VisibilityRules,
  Rule,
  Selector,
  RuleCtx,
  BuildRuleCtxArgs,
  BuildChromeCtxArgs,
  UseHoverTrackingArgs,
  HoverTracking,
} from '../features/chrome-caps';

// ─── Selection overlay: outlines, handles, composer ─────────────────────────
export {
  composeSelectionPose,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
  createSelectionOverlayLayer,
} from '../features/selection';
export type {
  ComposeSelectionPoseOpts,
  SelectionOutlineLayerOpts,
  SelectionHandlesLayerOpts,
  SelectionOverlayLayerOpts,
  SelectionHandleStyle,
} from '../features/selection';
