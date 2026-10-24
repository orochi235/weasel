import { describe, expect, expectTypeOf, it } from 'vitest';
import { prefLeaves, type PrefPath, type PrefValueAt } from '@weasel-js/prefs';
import type { KitSettingAt, KitSettingPath } from '@weasel-js/react';
import { ANCHOR_SNAP_PX, CURVE_HIT_PX as FUNCTION_CURVE_HIT_PX } from './components/CurveEditor/createFunctionLayer';
import { CURVE_HIT_PX, HANDLE_HIT_PX, KEY_HIT_PX } from './components/CurveEditor/createKeyframeLayer';
import { REPEAT_DELAY_MS, REPEAT_EVERY_MS } from './components/NumberField/useStepRepeat';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, type ParamsSurface } from './components/Prefs/commitPolicy';
import { COALESCE_MS } from './components/PrefSchemaEditor/useDocument';
import { FOCUS_DELAY } from './components/Properties/rowHelp';
import { STOP_SNAP_PX } from './components/Slider/stops';
import { DEFAULT_TTL_MS } from './components/Toast/queue';
import { TYPEAHEAD_MS } from './components/Tree/useTypeahead';
import { REST_MS } from './components/Tree/useRowTip';
import { HOVER_EXPAND_MS } from './components/Tree/useTreeDrag';
import { uiKitSettingsSchema } from './kitSettings';
import { SNAP_RADIUS_PX } from './snap';

type Schema = typeof uiKitSettingsSchema;
type UiPath = Extract<KitSettingPath, `${keyof Schema['children']}.${string}`>;

const surfaces: ParamsSurface[] = ['form', 'panel', 'lab'];

const expected: Record<string, unknown> = {
  'numberField.repeatDelayMs': REPEAT_DELAY_MS,
  'numberField.repeatEveryMs': REPEAT_EVERY_MS,
  ...Object.fromEntries(
    surfaces.flatMap((s) => [
      [`params.${s}.textWaitMs`, PARAMS_TEXT_WAIT_MS[s]],
      ...Object.entries(PARAMS_SETTLES[s]).map(([control, settles]) => [`params.${s}.settles.${control}`, settles]),
    ]),
  ),
  'tree.typeaheadMs': TYPEAHEAD_MS,
  'tree.hoverExpandMs': HOVER_EXPAND_MS,
  'tree.tipRestMs': REST_MS,
  'help.focusDelayMs': FOCUS_DELAY,
  'help.icon': false,
  'toast.ttlMs': DEFAULT_TTL_MS,
  'targets.curveKeyHitPx': KEY_HIT_PX,
  'targets.curveHandleHitPx': HANDLE_HIT_PX,
  'targets.curveHitPx': CURVE_HIT_PX,
  'targets.curveAnchorSnapPx': ANCHOR_SNAP_PX,
  'targets.functionCurveHitPx': FUNCTION_CURVE_HIT_PX,
  'targets.sliderStopSnapPx': STOP_SNAP_PX,
  'targets.snapRadiusPx': SNAP_RADIUS_PX,
  'history.coalesceMs': COALESCE_MS,
};

describe('uiKitSettingsSchema', () => {
  it('defaults every leaf to the constant its reader falls back to', () => {
    const leaves = prefLeaves(uiKitSettingsSchema);
    expect(Object.fromEntries([...leaves].map(([path, leaf]) => [path, leaf.default]))).toEqual(expected);
  });

  it('has exactly the KitSettings paths of the areas it covers, with their value types', () => {
    expectTypeOf<PrefPath<Schema>>().toExtend<KitSettingPath>();
    // `targets` is shared with other packages' keys, so only the areas ui owns alone are compared whole.
    expectTypeOf<Exclude<PrefPath<Schema>, `targets.${string}`>>().toEqualTypeOf<Exclude<UiPath, `targets.${string}`>>();
    expectTypeOf<PrefValueAt<Schema, 'tree.typeaheadMs'>>().toEqualTypeOf<KitSettingAt<'tree.typeaheadMs'>>();
    expectTypeOf<PrefValueAt<Schema, 'params.lab.settles.slider'>>().toEqualTypeOf<KitSettingAt<'params.lab.settles.slider'>>();
  });
});
