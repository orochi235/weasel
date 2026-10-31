import type { RefObject } from 'react';
import { Button } from '../Button';
import { MenuButton } from '../MenuButton';

/** One kind of entry a {@link ListEditor}'s add control offers. */
export interface ListEntryKind<T> {
  /** What the add menu calls it. */
  label: string;
  /** A new entry of this kind. */
  make: () => T;
}

/** A list's add control: a button for one kind of entry, a menu of them for several. */
export function AddEntry<T>({
  kinds,
  label,
  disabled,
  onAdd,
  buttonRef,
}: {
  kinds: readonly ListEntryKind<T>[];
  label: string;
  disabled: boolean;
  onAdd: (make: () => T) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [only] = kinds;
  if (kinds.length > 1) {
    return (
      <MenuButton
        buttonRef={buttonRef}
        label={label}
        isDisabled={disabled}
        items={kinds.map((kind, i) => ({ value: String(i), label: kind.label }))}
        onAction={(i) => {
          const kind = kinds[Number(i)];
          if (kind) onAdd(kind.make);
        }}
      />
    );
  }
  return (
    <Button ref={buttonRef} size="sm" disabled={disabled || !only} onClick={() => only && onAdd(only.make)}>
      {label}
    </Button>
  );
}
