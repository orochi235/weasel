import { useState } from 'react';
import { copyText } from '@weasel-js/react';
import { isPrefCondition, type PrefCondition } from '@weasel-js/prefs';
import { Button } from '@weasel-js/ui';
import s from './PrefConditionEditor.module.css';

const NOTHING = 'The clipboard holds no condition.';
const UNREAD = 'The clipboard could not be read.';

/**
 * Copy and Paste for a whole condition, which crosses the system clipboard as the JSON a schema holds it in: one
 * copied here pastes into another editor, and one written by hand pastes here. What a press did is said until the
 * condition changes.
 */
export function ConditionClipboard({ clipboard, value, onPaste }: { clipboard: Clipboard; value: PrefCondition | undefined; onPaste(next: PrefCondition): void }) {
  const [said, setSaid] = useState<{ text: string; of: PrefCondition | undefined } | null>(null);
  const say = (text: string): void => setSaid({ text, of: value });
  const copy = (): void => {
    void copyText(JSON.stringify(value, null, 2)).then((took) => say(took ? 'Copied.' : 'The clipboard took nothing.'));
  };
  const paste = async (): Promise<void> => {
    let text: string;
    try {
      text = await clipboard.readText();
    } catch {
      return say(UNREAD);
    }
    let held: unknown;
    try {
      held = JSON.parse(text);
    } catch {
      return say(NOTHING);
    }
    if (!isPrefCondition(held)) return say(NOTHING);
    setSaid(null);
    onPaste(held);
  };
  return (
    <div className={s.clipboard}>
      {said && said.of === value && <span className={s.said} role="status">{said.text}</span>}
      <Button variant="ghost" size="sm" aria-label="Copy condition" disabled={value === undefined} onClick={copy}>Copy</Button>
      <Button variant="ghost" size="sm" aria-label="Paste condition" onClick={() => { void paste(); }}>Paste</Button>
    </div>
  );
}
