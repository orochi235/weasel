import { useState } from 'react';
import { isPrefCondition, type PrefCondition } from '@weasel-js/prefs';
import { Button } from '../Button';
import s from './PrefConditionEditor.module.css';

const NOTHING = 'The clipboard holds no condition.';

/**
 * Copy and Paste for a whole condition, which crosses the system clipboard as the JSON a schema holds it in: one
 * copied here pastes into another editor, and one written by hand pastes here.
 */
export function ConditionClipboard({ clipboard, value, onPaste }: { clipboard: Clipboard; value: PrefCondition | undefined; onPaste(next: PrefCondition): void }) {
  const [said, setSaid] = useState<string | null>(null);
  const copy = (): void => {
    void clipboard.writeText(JSON.stringify(value, null, 2)).then(() => setSaid('Copied.'), () => setSaid('The clipboard took nothing.'));
  };
  const paste = async (): Promise<void> => {
    try {
      const held: unknown = JSON.parse(await clipboard.readText());
      if (!isPrefCondition(held)) return setSaid(NOTHING);
      setSaid(null);
      onPaste(held);
    } catch {
      setSaid(NOTHING);
    }
  };
  return (
    <div className={s.clipboard}>
      {said && <span className={s.said} role="status">{said}</span>}
      <Button variant="ghost" size="sm" ariaLabel="Copy condition" disabled={value === undefined} onClick={copy}>Copy</Button>
      <Button variant="ghost" size="sm" ariaLabel="Paste condition" onClick={() => { void paste(); }}>Paste</Button>
    </div>
  );
}
