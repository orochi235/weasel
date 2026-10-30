import type {} from '@weasel-js/react';
import { pref, type PrefNumber } from '@weasel-js/prefs';
import { ANCHOR_SNAP_PX, CURVE_HIT_PX as FUNCTION_CURVE_HIT_PX } from './components/CurveEditor/createFunctionLayer';
import { CURVE_HIT_PX, HANDLE_HIT_PX, KEY_HIT_PX } from './components/CurveEditor/createKeyframeLayer';
import { REPEAT_DELAY_MS, REPEAT_EVERY_MS } from '@weasel-js/headless';
import { PARAMS_SETTLES, PARAMS_TEXT_WAIT_MS, type ParamsSurface } from './components/Prefs/commitPolicy';
import type { ParamsPolicy } from './components/Prefs/useParamsPolicy';
import { COALESCE_MS } from './components/PrefSchemaEditor/useDocument';
import { FOCUS_DELAY } from './components/Properties/rowHelp';
import { STOP_SNAP_PX } from './components/Slider/stops';
import { DEFAULT_TTL_MS } from './components/Toast/queue';
import { TYPEAHEAD_MS } from './useTypeahead';
import { IDLE_SETTLE_MS } from './useIdleSettle';
import { REST_MS } from './components/Tree/useRowTip';
import { HOVER_EXPAND_MS } from './components/Tree/useTreeDrag';
import { SNAP_RADIUS_PX } from './snap';

declare module '@weasel-js/react' {
  interface KitSettings {
    numberField: { repeatDelayMs: number; repeatEveryMs: number };
    typing: { settleWhenIdle: boolean; idleMs: number };
    params: Record<ParamsSurface, ParamsPolicy>;
    tree: { typeaheadMs: number; hoverExpandMs: number; tipRestMs: number };
    help: { focusDelayMs: number; icon: boolean };
    toast: { ttlMs: number };
    targets: KitTargetSettings;
    history: { coalesceMs: number };
  }
  interface KitTargetSettings {
    curveKeyHitPx: number;
    curveHandleHitPx: number;
    curveHitPx: number;
    curveAnchorSnapPx: number;
    functionCurveHitPx: number;
    sliderStopSnapPx: number;
    snapRadiusPx: number;
  }
}

const ms = (name: string, def: number, max: number, description: string): PrefNumber =>
  pref.number(name, def, { description, min: 0, max, step: 10, unit: { scale: 1, suffix: 'ms' } });

const px = (name: string, def: number, description: string): PrefNumber =>
  pref.number(name, def, { description, min: 0, max: 48, step: 1, unit: { scale: 1, suffix: 'px' } });

const surface = (name: string, of: ParamsSurface) =>
  pref.group(name, {
    textWaitMs: ms('Text wait', PARAMS_TEXT_WAIT_MS[of], 2000, 'How long typed text waits for the next key before it is written.'),
    settles: pref.group('Write only the settled value', {
      number: pref.boolean('Number', PARAMS_SETTLES[of].number),
      slider: pref.boolean('Slider', PARAMS_SETTLES[of].slider),
      string: pref.boolean('Text', PARAMS_SETTLES[of].string),
      color: pref.boolean('Color', PARAMS_SETTLES[of].color),
    }),
  });

/**
 * The settings `@weasel-js/ui`'s components read, as a schema whose paths are
 * their `KitSettings` paths. Compose it with other packages' groups by
 * spreading `children`.
 */
export const uiKitSettingsSchema = pref.group('Components', {
  numberField: pref.group('Number fields', {
    repeatDelayMs: ms('Repeat delay', REPEAT_DELAY_MS, 2000, 'How long a held stepper waits before it repeats.'),
    repeatEveryMs: ms('Repeat interval', REPEAT_EVERY_MS, 1000, 'How often a held stepper steps once it repeats.'),
  }),
  typing: pref.group('Typing', {
    settleWhenIdle: pref.boolean('Write when idle', true, {
      description: 'A typed field writes its text once typing rests, as well as on Enter or leaving it.',
    }),
    idleMs: ms('Idle delay', IDLE_SETTLE_MS, 5000, 'How long typing rests before a field that writes when idle writes it.'),
  }),
  params: pref.group('Settings surfaces', {
    form: surface('Forms', 'form'),
    panel: surface('Panels', 'panel'),
    lab: surface('Labs', 'lab'),
  }),
  tree: pref.group('Trees', {
    typeaheadMs: ms('Typeahead', TYPEAHEAD_MS, 3000, 'How long a typed prefix lasts before the next key starts a new one.'),
    hoverExpandMs: ms('Expand on hover', HOVER_EXPAND_MS, 3000, 'How long a drag rests on a closed row before it opens.'),
    tipRestMs: ms('Tooltip delay', REST_MS, 3000, 'How long the pointer or focus rests on a row before its tooltip opens.'),
  }),
  help: pref.group('Help', {
    focusDelayMs: ms('Focus delay', FOCUS_DELAY, 3000, "How long keyboard focus rests on a row's control before its help opens."),
    icon: pref.boolean('Icon', false, { description: 'Mark a described row with an ⓘ beside its label.' }),
  }),
  toast: pref.group('Toasts', {
    ttlMs: ms('Duration', DEFAULT_TTL_MS, 60000, 'How long a toast stays when it does not set its own time.'),
  }),
  targets: pref.group('Targets', {
    curveKeyHitPx: px('Curve key', KEY_HIT_PX, 'How near a press must land to a keyframe to take it.'),
    curveHandleHitPx: px('Curve handle', HANDLE_HIT_PX, "How near a press must land to a keyframe's handle to take it."),
    curveHitPx: px('Keyframe curve', CURVE_HIT_PX, 'How near a press must land to a keyframe curve to take it.'),
    curveAnchorSnapPx: px('Curve anchor', ANCHOR_SNAP_PX, "How near a press must land to a function curve's anchor to take it."),
    functionCurveHitPx: px('Function curve', FUNCTION_CURVE_HIT_PX, 'How near a press must land to a function curve to take it.'),
    sliderStopSnapPx: px('Slider stop', STOP_SNAP_PX, "How near a slider's thumb must come to a stop to snap to it."),
    snapRadiusPx: px('Tick snap', SNAP_RADIUS_PX, 'How near a dragged value must come to a tick to snap to it.'),
  }),
  history: pref.group('History', {
    coalesceMs: ms('Coalesce', COALESCE_MS, 5000, 'Edits this close together undo as one step.'),
  }),
});
