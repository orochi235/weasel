import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Action,
  ActionDisabledReason,
  BETWEEN_GESTURES,
  type RenderLayer,
  type SceneCanvasApi,
  useAction,
  useLatest,
} from '@weasel-js/core';
import type { LoupeMode } from '@weasel-js/hud';
import { copyText } from '@weasel-js/react';
import { toast } from '@weasel-js/ui/components/Toast';
import { type LoupeSettings, useHud, useLoupe } from '@weasel-js/hud/react';
import { useIconRegistry } from '@weasel-js/icons/react';
import { isGenericFamily, registerCanvasFont } from '@weasel-js/font';
import { useThemeOptional } from '@weasel-js/theme/react';
import { pref } from '@weasel-js/prefs';
import { cssUnescape } from './cssUnescape';
import { icon } from './icons.gen';
import { LOUPE_FACTOR, LOUPE_MODE } from './loupePrefs';
import { drawPrefs, usePref } from './prefs';
import type { SchemaBinding } from './surfaces/types';
import { usePickColor } from './usePickColor';

/** Tells the user the clipboard did not take `hex`, and shows it so it can be copied by hand. */
function reportCopyRefused(hex: string): void {
  toast.warn(`${hex} was not copied`, { id: 'loupe-copy-refused', description: 'The browser would not let the page write to the clipboard.' });
}

/** The action that copies the hex under the loupe. */
export const LOUPE_COPY_ACTION = 'draw.loupe.copy';
const MODE_ICONS = { vector: icon('ui:vector'), pixel: icon('ui:pixels') } as const;
const PIN_ICON = icon('ui:pin');

/** The action that shows or hides the loupe. */
export const LOUPE_TOGGLE_ACTION = 'draw.loupe.toggle';

interface LoupeState extends LoupeSettings {
  /** Hex under the aim point. Null until the pointer has moved over the canvas with the loupe showing. */
  color: string | null;
  /** Show or hide the lens, for this session. */
  setVisible(visible: boolean): void;
}

/** Shown only while the loupe is. */
const WHILE_ON = { showIf: { path: 'on' } } as const;

/** The loupe's controls, as the surface asset draws them; {@link useLoupeBinding} binds their paths. */
export const LOUPE_SCHEMA = pref.group('Loupe', {
  on: pref.boolean('Loupe', false, { control: 'switch' }),
  mode: { ...LOUPE_MODE, ...WHILE_ON },
  factor: { ...LOUPE_FACTOR, ...WHILE_ON },
  color: pref.color('Color', '', { readout: true, ...WHILE_ON }),
  copy: pref.action(LOUPE_COPY_ACTION, {
    name: 'Copy',
    control: 'button',
    description: 'Copy the color under the loupe',
    enableIf: { path: 'color' },
    ...WHILE_ON,
  }),
});

const LoupeContext = createContext<LoupeState | null>(null);

export interface LoupeProviderProps {
  canvasRef: { current: SceneCanvasApi | null };
  /** `canvasRef` is populated. The lens mounts only then: `useHud` and `createLoupe` read it in a mount effect and
   *  neither retries. */
  ready: boolean;
  /** Layers the loupe re-renders through its magnified inner view. */
  source: RenderLayer<unknown>[];
  children?: ReactNode;
}

/** Owns whether the loupe shows and the color it reads, for every control that shows them, and keeps the lens to
 *  them and to its mode and magnification, which are prefs. */
export function LoupeProvider({ canvasRef, ready, source, children }: LoupeProviderProps) {
  const [visible, setShown] = useState(LOUPE_SCHEMA.children.on.default);
  const [mode] = usePref('loupe.mode');
  const [factor] = usePref('loupe.factor');
  const icons = useIconRegistry() ?? undefined;
  const settings = useMemo(
    (): LoupeSettings => ({ visible, mode, factor, ...(icons ? { icons, modeIcons: MODE_ICONS, pinIcon: PIN_ICON } : {}) }),
    [visible, mode, factor, icons],
  );
  const [color, setColor] = useState<string | null>(null);
  // A hidden lens reads nothing: the color it last read is not under any loupe now.
  const setVisible = useCallback((v: boolean) => {
    setShown(v);
    if (!v) setColor(null);
  }, []);

  const colorRef = useLatest(color);
  const hasColor = color !== null;
  // Rebuilt when `enabled` or `active` would answer otherwise: registry-drawn chrome re-reads them on a registration.
  const copy = useMemo((): Action => ({
    id: LOUPE_COPY_ACTION,
    label: 'Copy loupe color',
    enabled: () => (hasColor ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: () => {
        const hex = colorRef.current;
        if (hex) void copyText(hex).then((took) => { if (!took) reportCopyRefused(hex); });
      },
    },
  }), [colorRef, hasColor]);
  useAction(copy);

  const toggle = useMemo((): Action => ({
    id: LOUPE_TOGGLE_ACTION,
    label: 'Loupe',
    // F2, as labkit's quick lens takes it.
    defaultBinding: [{ spec: { kind: 'key', key: 'F2', phase: BETWEEN_GESTURES }, opts: { id: `${LOUPE_TOGGLE_ACTION}.key` } }],
    active: () => visible,
    invoker: { timing: 'immediate', run: () => setVisible(!visible) },
  }), [visible, setVisible]);
  useAction(toggle);

  const state = useMemo((): LoupeState => ({ ...settings, color, setVisible }), [settings, color, setVisible]);

  return (
    <LoupeContext.Provider value={state}>
      {ready && <LoupeLens canvasRef={canvasRef} source={source} settings={settings} state={state} onColor={setColor} />}
      {children}
    </LoupeContext.Provider>
  );
}

function LoupeLens({ canvasRef, source, settings, state, onColor }: {
  canvasRef: LoupeProviderProps['canvasRef'];
  source: RenderLayer<unknown>[];
  settings: LoupeSettings;
  state: LoupeState;
  onColor: (hex: string | null) => void;
}) {
  const hud = useHud(canvasRef, { font: useThemeUiFont() });
  // Unmounted, the lens reads nothing, and says so.
  useEffect(() => () => onColor(null), [onColor]);
  const pickColor = usePickColor();
  useLoupe(canvasRef, hud, source, settings, {
    onColorChange: onColor,
    onPick: pickColor,
    onClose: () => state.setVisible(false),
    onModeChange: (mode) => drawPrefs().set('loupe.mode', mode),
    onFactorChange: (factor) => drawPrefs().set('loupe.factor', factor),
  });
  return null;
}

/** The theme's UI face, enrolled as a canvas font so the HUD can set its text in it; the baked `sans-serif` where
 *  the theme names none. */
function useThemeUiFont(): string {
  const family = uiFontFamily(useThemeOptional()?.resolved['--wzl-font-ui']);
  useEffect(() => (isGenericFamily(family) ? undefined : registerCanvasFont(family)), [family]);
  return family;
}

/** The first family of the CSS family list `stack`, unquoted; `sans-serif` for none, or for one a function such as
 *  `var()` computes, which only a browser resolves. */
export function uiFontFamily(stack: string | undefined): string {
  const head = stack === undefined ? '' : firstListEntry(stack);
  if (!head || /^[\w-]+\(/.test(head)) return 'sans-serif';
  const quoted = /^(["'])(.*)\1$/.exec(head);
  return quoted ? cssUnescape(quoted[2]!) : cssUnescape(head.replace(/\s+/g, ' '));
}

/** `list` up to its first comma outside quotes and brackets, trimmed. */
function firstListEntry(list: string): string {
  let depth = 0;
  let quote: string | null = null;
  let i = 0;
  for (; i < list.length; i++) {
    const c = list[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) break;
  }
  return list.slice(0, i).trim();
}

const NO_LOUPE: SchemaBinding = {};

const isLoupeMode = (value: unknown): value is LoupeMode => LOUPE_MODE.options.some((o) => o.value === value);

/** The loupe asset's leaves bound to the loupe in scope: `on`, `mode`, `factor`, and `color`. Unbound outside a
 *  {@link LoupeProvider}. */
export function useLoupeBinding(): SchemaBinding {
  const state = useContext(LoupeContext);
  return useMemo((): SchemaBinding => {
    if (!state) return NO_LOUPE;
    return {
      values: {
        on: state.visible,
        mode: state.mode,
        factor: state.factor,
        ...(state.color ? { color: state.color } : {}),
      },
      onChange: (path, value) => {
        if (path === 'on') state.setVisible(value === true);
        else if (path === 'mode' && isLoupeMode(value)) drawPrefs().set('loupe.mode', value);
        else if (path === 'factor' && typeof value === 'number') drawPrefs().set('loupe.factor', value);
      },
    };
  }, [state]);
}
