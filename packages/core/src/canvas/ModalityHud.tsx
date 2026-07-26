/**
 * Dev HUD reporting the modality state: active mode, active-slot tool, and
 * the hotkey-engaged tool stack. Anchors below `PickHud` in the canvas's
 * top-right corner.
 *
 * Mode id is supplied by the consumer (apps that haven't yet wired the
 * modality machine pass `undefined`; the line renders as `—`). Active /
 * hotkey state is read live from `useOptionalActiveToolContext` so the HUD
 * stays in sync with tool switches and hotkey engage/disengage without
 * prop plumbing.
 */
import { useEffect, useState } from 'react';
import { useOptionalActiveToolContext } from '../interactions/actions/activeToolContext';
import s from './ModalityHud.module.css';

export interface ModalityHudProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Active modality mode id. Omit until the mode machine is wired —
   *  the row renders `—` in that case. */
  modeId?: string;
  /** Inset from the canvas's top-right corner. Default `{ top: 220, right: 8 }`
   *  so the HUD clears `PickHud` (which itself sits at ~76, with variable
   *  height for the id list). Override if the pick list is unusually tall. */
  offset?: { top?: number; right?: number };
}

interface HudState {
  anchor: { top: number; right: number } | null;
}

export function ModalityHud({ canvasRef, modeId, offset }: ModalityHudProps) {
  const toolCtx = useOptionalActiveToolContext();
  const [state, setState] = useState<HudState>({ anchor: null });

  useEffect(() => {
    const readAnchor = (): HudState['anchor'] => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const host = canvas.parentElement ?? canvas;
      const rect = host.getBoundingClientRect();
      return { top: rect.top, right: window.innerWidth - rect.right };
    };

    const onLayout = () => setState({ anchor: readAnchor() });

    onLayout();
    window.addEventListener('scroll', onLayout, true);
    window.addEventListener('resize', onLayout);
    return () => {
      window.removeEventListener('scroll', onLayout, true);
      window.removeEventListener('resize', onLayout);
    };
  }, [canvasRef]);

  if (!state.anchor) return null;

  const top = state.anchor.top + (offset?.top ?? 220);
  const right = state.anchor.right + (offset?.right ?? 8);
  const style = { top, right };

  const active = toolCtx?.active ?? null;
  const hotkeys = toolCtx?.hotkeyStack ?? [];
  const hotkeyTop = hotkeys.length > 0 ? hotkeys[hotkeys.length - 1] : null;

  return (
    <div className={s.hud} style={style}>
      <div className={s.row}>
        <span className={s.label}>mode</span>
        <span className={modeId ? s.value : s.valueMuted}>{modeId ?? '—'}</span>
      </div>
      <div className={s.row}>
        <span className={s.label}>active</span>
        <span className={active ? s.value : s.valueMuted}>{active ?? '—'}</span>
      </div>
      <div className={s.row}>
        <span className={s.label}>hotkey</span>
        {hotkeys.length <= 1 ? (
          <span className={hotkeyTop ? s.value : s.valueMuted}>{hotkeyTop ?? '—'}</span>
        ) : (
          <span className={s.stack}>
            {hotkeys.slice().reverse().map((id, i) => (
              <span key={`${id}-${i}`} className={i === 0 ? s.value : s.valueMuted}>
                {id}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
