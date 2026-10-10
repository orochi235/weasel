import type { ReactNode } from 'react';
import { Button } from '../Button';
import s from './PrefSchemaEditor.module.css';

const DRAFT_TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * The strip across the top of the editor: the host's own controls, the tools that add to and remove from the
 * schema, and the steps back and forward through the edits.
 */
export function EditorBar({ lead, toolSlot, canUndo, canRedo, onStep, draftSavedAt, onDiscard }: {
  /** The host's controls, set first. */
  lead?: ReactNode;
  /** Takes the element the structure pane draws its tools into. */
  toolSlot(el: HTMLDivElement | null): void;
  canUndo: boolean;
  canRedo: boolean;
  onStep(to: 'undo' | 'redo'): void;
  /** When the draft was last kept, or `null` with none. */
  draftSavedAt: number | null;
  onDiscard(): void;
}) {
  return (
    <div className={s.bar} role="group" aria-label="Schema tools">
      {lead}
      <div className={s.barTools} ref={toolSlot} />
      <Button size="sm" variant="ghost" disabled={!canUndo} onClick={() => onStep('undo')}>Undo</Button>
      <Button size="sm" variant="ghost" disabled={!canRedo} onClick={() => onStep('redo')}>Redo</Button>
      {draftSavedAt !== null && (
        <>
          <Button size="sm" variant="ghost" onClick={onDiscard}>Discard draft</Button>
          {/* Last: the time changes, and nothing sits after it to be pushed about. */}
          <span className={s.draftNote}>Draft saved {DRAFT_TIME.format(draftSavedAt)}</span>
        </>
      )}
    </div>
  );
}
