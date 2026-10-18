import type { PrefLeaf } from '@weasel-js/prefs';
import type { EntryAt } from './entry';
import { renderPrefControl, type PrefRenderer } from './PrefsRow';
import { useParamsPolicy } from './useParamsPolicy';
import type { PrefFieldChoice } from './schema';

/** Props for {@link PrefControl}. */
export interface PrefControlProps {
  pref: PrefLeaf;
  /** The path the leaf's value is stored at, which a renderer and an action are told. */
  path?: string;
  /** The leaf's value. `undefined` shows its default. */
  value: unknown;
  /** Everything the surface edits, from its root: what a renderer's context carries as `values`. */
  values?: unknown;
  /** Every edit, with the leaf's whole value. */
  onChange: (value: unknown) => void;
  /** Controls for app-defined kinds, wherever in the value they turn up. */
  renderers?: Record<string, PrefRenderer>;
  /** The fields a `field` leaf may name. */
  fields?: readonly PrefFieldChoice[];
  /** The control takes no input. */
  disabled?: boolean;
  /** Whether a condition disables the field at a path under the leaf's. An entry of a list or a map is asked
   *  about with `*` for its step (`'phases.*.hold'`), as `applyPrefConditions` names it. */
  disabledAt?: (path: string) => boolean;
  /** An entry of a list or a map as the conditions that read the entry (`from: 'item'`) leave it, for an owner
   *  that answers them: `applyPrefEntryConditions`. Without it such a condition counts as holding. */
  entryAt?: EntryAt;
}

/**
 * One leaf's control as `PrefsForm` draws it, without the row around it: for a
 * surface that lays out its own rows and has a leaf whose value is made of
 * others' (an `object`, a `list`, a `map`, a `union`) to put in one.
 */
export function PrefControl({ pref, path = '', value, values, onChange, renderers, fields, disabled, disabledAt, entryAt }: PrefControlProps) {
  const { settles } = useParamsPolicy('form');
  return renderPrefControl(
    {
      path,
      pref,
      value: value !== undefined ? value : pref.default,
      values,
      setValue: onChange,
      auto: false,
      setAuto: () => {},
      ...(fields ? { fields } : {}),
      disabled,
      disabledAt,
      ...(entryAt ? { entryAt } : {}),
      settles,
    },
    renderers,
  );
}
