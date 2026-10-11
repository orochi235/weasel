import type { ReactNode } from 'react';
import { Icon } from '../../icons';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import s from './PrefSchemaEditor.module.css';

const DRAFT_TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * The strip across the top of the editor: the host's own controls, the tools that add to and remove from the
 * schema, and the steps back and forward through the edits.
 */
export function EditorBar({ lead, toolSlot, canUndo, canRedo, onStep, draftSavedAt, onDiscard, prefs }: {
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
  /** The way into the editor's own settings. */
  prefs: ReactNode;
}) {
  return (
    <div className={s.bar} role="group" aria-label="Schema tools">
      <div className={s.barLead}>{lead}</div>
      <div className={s.barTools} ref={toolSlot} />
      <div className={s.barEnd}>
        <div className={s.palette}>
          <ToolGroup orientation="horizontal" ariaLabel="History and settings">
            <ToolButton icon={<Icon name="undo" />} label="Undo" disabled={!canUndo} onClick={() => onStep('undo')} />
            <ToolButton icon={<Icon name="redo" />} label="Redo" disabled={!canRedo} onClick={() => onStep('redo')} />
            {draftSavedAt !== null && <ToolButton icon={<Icon name="reset" />} label="Discard draft" title="Go back to the schema in source" onClick={onDiscard} />}
            {prefs}
          </ToolGroup>
        </div>
        {/* Last: the time changes, and nothing sits after it to be pushed about. */}
        {draftSavedAt !== null && <span className={s.draftNote}>Draft saved {DRAFT_TIME.format(draftSavedAt)}</span>}
      </div>
    </div>
  );
}
