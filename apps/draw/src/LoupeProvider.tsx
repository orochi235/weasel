import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import {
  type Action,
  ActionDisabledReason,
  type RenderLayer,
  type SceneCanvasApi,
  useAction,
  useLatest,
} from '@weasel-js/core';
import type { LoupeMode } from '@weasel-js/hud';
import { copyText } from '@weasel-js/react';
import { toast } from '@weasel-js/ui/components/Toast';
import { type LoupeSettings, useHud, useLoupe } from '@weasel-js/hud/react';
import { pref } from '@weasel-js/prefs';
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
  const [visible, setVisible] = useState(LOUPE_SCHEMA.children.on.default);
  const [mode] = usePref('loupe.mode');
  const [factor] = usePref('loupe.factor');
  const settings = useMemo((): LoupeSettings => ({ visible, mode, factor }), [visible, mode, factor]);
  const [color, setColor] = useState<string | null>(null);

  const colorRef = useLatest(color);
  const copy = useMemo((): Action => ({
    id: LOUPE_COPY_ACTION,
    label: 'Copy loupe color',
    enabled: () => (colorRef.current ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: () => {
        const hex = colorRef.current;
        if (hex) void copyText(hex).then((took) => { if (!took) reportCopyRefused(hex); });
      },
    },
  }), [colorRef]);
  useAction(copy);

  const state = useMemo((): LoupeState => ({ ...settings, color, setVisible }), [settings, color]);

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
  const hud = useHud(canvasRef, { font: 'sans-serif' });
  const pickColor = usePickColor();
  useLoupe(canvasRef, hud, source, settings, {
    onColorChange: onColor,
    onPick: pickColor,
    onClose: () => state.setVisible(false),
  });
  return null;
}

const NO_LOUPE: SchemaBinding = {};

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
        else if (path === 'mode') drawPrefs().set('loupe.mode', value as LoupeMode);
        else if (path === 'factor' && typeof value === 'number') drawPrefs().set('loupe.factor', value);
      },
    };
  }, [state]);
}
