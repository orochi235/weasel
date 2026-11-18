import { Button, CLOSE_BUTTON_PROPS } from '@weasel-js/ui';
import s from './PrefSchemaEditor.module.css';

/** What the editor says of a draft that did not open on the source it was saved against. */
export const DRAFT_NOTICE = {
  same: null,
  carried: 'The source changed since this draft was saved. Your edits were kept on top of it.',
  unknown: 'This draft does not say which source it edited, so changes the source has made since may be listed as yours. Discard draft to start from the source.',
} as const;

/** The line the editor tells the reader something on, with a button to dismiss it; empty with nothing to say. */
export function EditorNotice({ notice, onDismiss }: { notice: string | null; onDismiss(): void }) {
  return (
    <div className={s.notice} role="status">
      {notice && (
        <>
          <span>{notice}</span>
          <Button {...CLOSE_BUTTON_PROPS} aria-label="Dismiss" onClick={onDismiss} />
        </>
      )}
    </div>
  );
}
