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
import { useOptionalActiveToolContext } from '../interactions/actions/activeToolContext';
import { useHostAnchor } from './useHostAnchor';
import s from './ModalityHud.module.css';

export interface ModalityHudProps {
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Element the HUD pins its corner to. Defaults to the canvas's parent — the
   *  wrapper a bare `<canvas>` sits in. A detached canvas passes its own input
   *  box, whose parent is the shared surface every pane sits in. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Active modality mode id. Omit until the mode machine is wired —
   *  the row renders `—` in that case. */
  modeId?: string;
  /** Inset from the canvas's top-right corner. Default `{ top: 220, right: 8 }`
   *  so the HUD clears `PickHud` (which itself sits at ~76, with variable
   *  height for the id list). Override if the pick list is unusually tall. */
  offset?: { top?: number; right?: number };
}

export function ModalityHud({ canvasRef, anchorRef, modeId, offset }: ModalityHudProps) {
  const toolCtx = useOptionalActiveToolContext();
  const { ref, style } = useHostAnchor(
    () => anchorRef?.current ?? canvasRef.current?.parentElement ?? canvasRef.current,
    {
      align: { x: 'end', y: 'start' },
      offset: { x: offset?.right ?? 8, y: offset?.top ?? 220 },
    },
  );

  if (!style) return null;

  const active = toolCtx?.active ?? null;
  const hotkeys = toolCtx?.hotkeyStack ?? [];
  const hotkeyTop = hotkeys.length > 0 ? hotkeys[hotkeys.length - 1] : null;

  return (
    <div ref={ref} className={s.hud} style={style}>
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
