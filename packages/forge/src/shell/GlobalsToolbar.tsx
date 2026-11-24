import { Select, useLabContext, usePersistedState } from '@weasel-js/labkit';
import type { ListOption } from '@weasel-js/ui/components/Select';
import type { IconSpec } from '@weasel-js/icons';
import { Button } from '@weasel-js/ui/components/Button';
import { Callout } from '@weasel-js/ui/components/Callout';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon as glyph } from '../icons.gen';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getOwn } from '@weasel-js/registry';
import { isPlainObject } from '@weasel-js/core';
import type { StoryGlobals } from '../protocol/messages';
import { followApp, type GlobalDeclaration, type GlobalDeclarations, type GlobalOption, labGlobals, labOptions } from './globals';

const RECORD = 'fg-globals';

/**
 * The lab's global values, as persisted in the lab, and a setter for one. The setter writes onto what was stored, not
 * onto the values read from it, so a choice another global's `shows` hides for now comes back once it shows again.
 */
export function useLabGlobals(declarations: GlobalDeclarations): [StoryGlobals, (key: string, value: string) => void] {
  const [stored, setStored] = usePersistedState<unknown>(RECORD, null, { scope: 'lab' });
  const { mode } = useLabContext();
  const values = useMemo(() => labGlobals(declarations, stored, { mode }), [declarations, stored, mode]);
  const set = useCallback(
    (key: string, value: string) => setStored((prev: unknown) => ({ ...(isPlainObject(prev) ? prev : {}), [key]: value })),
    [setStored],
  );
  return [values, set];
}

/** A global's option as the select draws it. */
function selectOption({ value, label, icon, disabled, disabledReason, description }: GlobalOption): ListOption {
  return {
    value, label,
    ...(icon ? { icon: <Icon name={icon} size={16} /> } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(disabledReason ? { disabledReason } : {}),
    ...(description ? { description } : {}),
  };
}

interface GlobalSelectProps {
  name: string;
  declaration: GlobalDeclaration;
  values: StoryGlobals;
  /** `values` with each `App` resolved, which `shows` is asked with. */
  asked: StoryGlobals;
  set: (key: string, value: string) => void;
  labeled?: boolean;
}

function GlobalSelect({ name, declaration, values, asked, set, labeled = false }: GlobalSelectProps) {
  return (
    <Select
      {...(labeled ? { label: declaration.label } : { 'aria-label': declaration.label })}
      width={labeled ? 'fill' : 'fit'}
      selectedKey={String(getOwn(values, name))}
      onSelectionChange={(value) => set(name, value)}
      options={labOptions(declaration, asked).map(selectOption)}
    />
  );
}

/**
 * The lab's header control for its global values: one select per declaration, then, at the end, a button for each
 * declaration that others are declared `under`, opening those others in a popover.
 */
export function GlobalsToolbar({ declarations }: { declarations: GlobalDeclarations }) {
  const [values, set] = useLabGlobals(declarations);
  const { mode } = useLabContext();
  const asked = useMemo(() => followApp(declarations, values, { mode }), [declarations, values, mode]);
  const entries = Object.entries(declarations);
  const top = entries.filter(([, declaration]) => declaration.under === undefined);
  return (
    <div className="fg-globals" role="toolbar" aria-label="Globals">
      {top.map(([key, declaration]) => (
        <div key={key} className="fg-globals__item">
          <GlobalSelect name={key} declaration={declaration} values={values} asked={asked} set={set} />
        </div>
      ))}
      {top.map(([key, declaration]) => {
        const nested = entries.filter(([, other]) => other.under === key);
        return nested.length > 0 ? (
          <NestedGlobals
            key={key}
            label={declaration.label}
            icon={declaration.icon ?? glyph('core:tune')}
            nested={nested}
            values={values}
            asked={asked}
            set={set}
          />
        ) : null;
      })}
    </div>
  );
}

function NestedGlobals({
  label,
  icon,
  nested,
  values,
  asked,
  set,
}: {
  label: string;
  icon: IconSpec;
  nested: readonly [string, GlobalDeclaration][];
  values: StoryGlobals;
  asked: StoryGlobals;
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
        aria-label={`More ${label} settings`}
        pressed={open}
        onClick={() => setOpen((was) => !was)}
      >
        <Icon name={icon} size={16} />
      </Button>
      <Callout
        triggerRef={anchor}
        open={open}
        onOpenChange={setOpen}
        placement="bottom end"
        showCloseButton={false}
        title={label}
        className="fg-globals__popover"
      >
        {nested.map(([key, declaration]) => (
          <GlobalSelect key={key} name={key} declaration={declaration} values={values} asked={asked} set={set} labeled />
        ))}
      </Callout>
    </>
  );
}

/**
 * Reports the lab's global values, as the toolbar persists them and with each `App` resolved against the lab's own
 * chrome, to `onChange`. Renders nothing; mount it inside the lab.
 */
export function LabGlobals({
  declarations,
  onChange,
}: {
  declarations: GlobalDeclarations;
  onChange: (values: StoryGlobals) => void;
}) {
  const [values] = useLabGlobals(declarations);
  const { mode } = useLabContext();
  const resolved = useMemo(() => followApp(declarations, values, { mode }), [declarations, values, mode]);
  // Before paint, so no trial is ever drawn with the values the lab held before it opened.
  useLayoutEffect(() => onChange(resolved), [resolved, onChange]);
  return null;
}
