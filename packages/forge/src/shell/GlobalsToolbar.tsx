import { Select, usePersistedState } from '@weasel-js/labkit';
import { Button, Callout, TuneIcon } from '@weasel-js/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Globals } from '../protocol/messages';
import { type GlobalDeclaration, type GlobalDeclarations, labGlobals } from './globals';

const RECORD = 'fg-globals';

function useLabGlobals(declarations: GlobalDeclarations): [Globals, (key: string, value: string) => void] {
  const [stored, setStored] = usePersistedState<unknown>(RECORD, null, { scope: 'lab' });
  const values = useMemo(() => labGlobals(declarations, stored), [declarations, stored]);
  const set = useCallback(
    (key: string, value: string) => setStored((prev: unknown) => ({ ...labGlobals(declarations, prev), [key]: value })),
    [declarations, setStored],
  );
  return [values, set];
}

interface GlobalSelectProps {
  name: string;
  declaration: GlobalDeclaration;
  values: Globals;
  set: (key: string, value: string) => void;
  labeled?: boolean;
}

function GlobalSelect({ name, declaration, values, set, labeled = false }: GlobalSelectProps) {
  return (
    <Select
      {...(labeled ? { label: declaration.label } : { 'aria-label': declaration.label })}
      width={labeled ? 'fill' : 'fit'}
      selectedKey={String(values[name])}
      onSelectionChange={(value) => set(name, value)}
      options={declaration.options}
    />
  );
}

/**
 * The lab's header control for its global values: one select per declaration, and beside any declaration that others
 * are declared `under`, a button opening those others in a popover.
 */
export function GlobalsToolbar({ declarations }: { declarations: GlobalDeclarations }) {
  const [values, set] = useLabGlobals(declarations);
  const entries = Object.entries(declarations);
  return (
    <div className="fg-globals" role="toolbar" aria-label="Globals">
      {entries
        .filter(([, declaration]) => declaration.under === undefined)
        .map(([key, declaration]) => {
          const nested = entries.filter(([, other]) => other.under === key);
          return (
            <div key={key} className="fg-globals__item">
              <GlobalSelect name={key} declaration={declaration} values={values} set={set} />
              {nested.length > 0 ? (
                <NestedGlobals label={declaration.label} nested={nested} values={values} set={set} />
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

function NestedGlobals({
  label,
  nested,
  values,
  set,
}: {
  label: string;
  nested: readonly [string, GlobalDeclaration][];
  values: Globals;
  set: (key: string, value: string) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        ref={anchor}
        variant="ghost"
        size="sm"
        iconOnly
        ariaLabel={`More ${label} settings`}
        pressed={open}
        onClick={() => setOpen((was) => !was)}
      >
        <TuneIcon size={16} />
      </Button>
      <Callout
        triggerRef={anchor}
        isOpen={open}
        onOpenChange={setOpen}
        placement="bottom end"
        showCloseButton={false}
        title={label}
        className="fg-globals__popover"
      >
        {nested.map(([key, declaration]) => (
          <GlobalSelect key={key} name={key} declaration={declaration} values={values} set={set} labeled />
        ))}
      </Callout>
    </>
  );
}

/** Reports the lab's global values, as the toolbar persists them, to `onChange`. Renders nothing; mount it inside the lab. */
export function LabGlobals({
  declarations,
  onChange,
}: {
  declarations: GlobalDeclarations;
  onChange: (values: Globals) => void;
}) {
  const [values] = useLabGlobals(declarations);
  useEffect(() => onChange(values), [values, onChange]);
  return null;
}
