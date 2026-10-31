import { useLastOperation, useLastOperationStore, type LastOperationStore } from '@weasel-js/core';
import { CloseButton } from '../CloseButton';
import { PrefsForm } from '../Prefs/PrefsForm';
import s from './LastOperationPanel.module.css';

/** Props for {@link LastOperationPanel}. */
export interface LastOperationPanelProps {
  /** Where the operation comes from. Default: the store of the actions tree in scope. */
  store?: LastOperationStore | null;
  /** The close button's accessible name. Default `'Close'`. */
  closeLabel?: string;
  /** Places the panel; it sets no position of its own. */
  className?: string;
}

/**
 * The last command run that has parameters, titled with its label and holding
 * its parameters at the values it used. Changing one reruns the command in
 * place, still as one undo entry. Renders nothing while there is no such
 * command: any other change to the history, an undo or redo, or the close
 * button clears it.
 */
export function LastOperationPanel({ store, closeLabel = 'Close', className }: LastOperationPanelProps) {
  const inScope = useLastOperationStore();
  const source = store === undefined ? inScope : store;
  const op = useLastOperation(source);
  if (!source || !op) return null;
  return (
    <section className={[s.panel, className].filter(Boolean).join(' ')} aria-label={op.label}>
      <header className={s.header}>
        <h2 className={s.title}>{op.label}</h2>
        <CloseButton ariaLabel={closeLabel} onClick={source.dismiss} />
      </header>
      <PrefsForm schema={op.schema} layout="list" values={op.values} onChange={(path, value) => source.adjust({ [path]: value })} />
    </section>
  );
}
