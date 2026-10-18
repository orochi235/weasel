import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import {
  type Action,
  ActionDisabledReason,
  type RenderLayer,
  type SceneCanvasApi,
  useAction,
  useActionsRegistry,
  useLatest,
} from '@weasel-js/core';
import type { LoupeMode } from '@weasel-js/hud';
import { useHud } from '@weasel-js/hud/react';
import { pref } from '@weasel-js/prefs';
import type { SchemaBinding } from './surfaces/types';
import { useColorContext } from './tools/colorContext';
import { type LoupeSettings, useLoupe } from './useLoupe';

/** The action that copies the hex under the loupe. */
export const LOUPE_COPY_ACTION = 'draw.loupe.copy';

interface LoupeState extends LoupeSettings {
  /** Hex under the aim point. Null until the pointer has moved over the canvas with the loupe showing. */
  color: string | null;
  set(patch: Partial<LoupeSettings>): void;
}

/** Shown only while the loupe is. */
const WHILE_ON = { showIf: { path: 'on' } } as const;

/** The loupe's controls, as the surface asset draws them; {@link useLoupeBinding} binds their paths. */
export const LOUPE_SCHEMA = pref.group('Loupe', {
  on: pref.boolean('Loupe', false, { control: 'switch' }),
  mode: pref.enum<LoupeMode>('Mode', 'vector', ['vector', 'pixel'], { control: 'toggle', ...WHILE_ON }),
  factor: pref.number('Magnification', 8, { min: 2, max: 16, step: 1, short: ['Zoom'], ...WHILE_ON }),
  color: pref.color('Color', '', { readout: true, ...WHILE_ON }),
  copy: pref.action(LOUPE_COPY_ACTION, {
    name: 'Copy',
    control: 'button',
    description: 'Copy the color under the loupe',
    enableIf: { path: 'color' },
    ...WHILE_ON,
  }),
});

const { on, mode, factor } = LOUPE_SCHEMA.children;
const INITIAL: LoupeSettings = { visible: on.default, mode: mode.default, factor: factor.default };

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

/** Owns the loupe's settings and the color it reads, for every control that shows them, and keeps the lens to
 *  them. */
export function LoupeProvider({ canvasRef, ready, source, children }: LoupeProviderProps) {
  const [settings, setSettings] = useState(INITIAL);
  const [color, setColor] = useState<string | null>(null);

  const colorRef = useLatest(color);
  const copy = useMemo((): Action => ({
    id: LOUPE_COPY_ACTION,
    label: 'Copy loupe color',
    enabled: () => (colorRef.current ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: () => { if (colorRef.current) void navigator.clipboard.writeText(colorRef.current); },
    },
  }), [colorRef]);
  useAction(copy);

  const state = useMemo((): LoupeState => ({
    ...settings,
    color,
    set: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
  }), [settings, color]);

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
  onColor: (hex: string) => void;
}) {
  const hud = useHud(canvasRef, { font: 'sans-serif' });
  const colors = useColorContext();
  const actions = useActionsRegistry();
  useLoupe(canvasRef, hud, source, settings, {
    onColorChange: onColor,
    // A pick is the swatch edit arriving from a different control: it sets the
    // focused paint and, through the same action the swatch dispatches, paints
    // the selection with it.
    onPick: (hex) => {
      colors.setFocusedColor(hex);
      actions?.begin(colors.focused === 'fill' ? 'setFill' : 'setStroke', { color: hex })?.end('commit');
    },
    onClose: () => state.set({ visible: false }),
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
        if (path === 'on') state.set({ visible: value === true });
        else if (path === 'mode') state.set({ mode: value as LoupeMode });
        else if (path === 'factor' && typeof value === 'number') state.set({ factor: value });
      },
    };
  }, [state]);
}
