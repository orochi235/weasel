import { useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Input } from '../Input';
import { Select } from '../Select';
import { keyFromName, keyProblem, type ChildMap } from './schemaEdit';
import type { KindChoice } from './types';
import s from './PrefSchemaEditor.module.css';

/** What a new node is called, and for a pref, the kind picker's value for what it is. */
export interface NewNode {
  key: string;
  name: string;
  kind?: string;
}

export interface AddNodeDialogProps {
  /** `'pref'` asks for a kind as well; a group or a section needs none, and its name may stay empty. */
  what: 'pref' | 'group' | 'section' | null;
  /** The children the new node joins, so its id cannot collide with one of them. */
  siblings: ChildMap;
  /** Whether the id may be a dotted path, as a pref's is where sections nest. */
  dottedKey?: boolean;
  /** What a new pref may be: each kind, and each type by name. */
  kinds: readonly KindChoice[];
  onAdd(node: NewNode): void;
  onClose(): void;
}

/** Asks for the least a new pref, group or section needs before it exists: a name, the id it is keyed by, and a pref's kind.
 *  The id follows the name until it is typed into. */
export function AddNodeDialog({ what, siblings, dottedKey, kinds, onAdd, onClose }: AddNodeDialogProps) {
  return (
    <Dialog isOpen={what !== null} onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Add ${what ?? 'pref'}`}>
      {what && (
        <AddNodeForm key={what} what={what} siblings={siblings} dottedKey={dottedKey} kinds={kinds}
          onAdd={onAdd} onClose={onClose} />
      )}
    </Dialog>
  );
}

function AddNodeForm({ what, siblings, dottedKey, kinds, onAdd, onClose }: Omit<AddNodeDialogProps, 'what'> & { what: 'pref' | 'group' | 'section' }) {
  const [name, setName] = useState('');
  const [typedKey, setTypedKey] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const key = typedKey ?? keyFromName(name);
  const problem = keyProblem(siblings, key, dottedKey);
  const missing = what === 'pref' && (name.trim() === '' || kind === null);
  const ready = problem === null && !missing;
  // Only once something has been typed: an empty form is not yet wrong.
  const shownProblem = typedKey !== null || name !== '' ? problem : null;

  return (
    <form className={s.addForm} onSubmit={(e) => {
      e.preventDefault();
      if (!ready) return;
      onAdd({ key, name: name.trim(), ...(kind !== null ? { kind } : {}) });
    }}>
      <Input label="Name" value={name} onChange={setName} autoFocus isRequired={what === 'pref'}
        description={what === 'pref' ? undefined : `Optional: a ${what} with no name shows no heading.`} />
      <Input label="Id" value={key} onChange={setTypedKey} isRequired className={s.symbol}
        isInvalid={shownProblem !== null} errorMessage={shownProblem ?? undefined} />
      {what === 'pref' && (
        <Select label="Kind" placeholder="Choose a kind" selectedKey={kind} onSelectionChange={(k) => setKind(String(k))}
          options={kinds} isRequired />
      )}
      <div className={s.addActions}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={!ready}>Add</Button>
      </div>
    </form>
  );
}
