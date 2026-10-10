import type { PrefLeaf } from '@weasel-js/prefs';
import { renderPrefControl, type PrefRenderer } from './PrefsRow';
import type { PrefFieldChoice } from './schema';

/** Props for {@link PrefControl}. */
export interface PrefControlProps {
  pref: PrefLeaf;
  /** The path the leaf's value is stored at, which a renderer and an action are told. */
  path?: string;
  /** The leaf's value. `undefined` shows its default. */
  value: unknown;
  /** Every edit, with the leaf's whole value. */
  onChange: (value: unknown) => void;
  /** Controls for app-defined kinds, wherever in the value they turn up. */
  renderers?: Record<string, PrefRenderer>;
  /** The fields a `field` leaf may name. */
  fields?: readonly PrefFieldChoice[];
}

/**
 * One leaf's control as `PrefsForm` draws it, without the row around it: for a
 * surface that lays out its own rows and has a leaf whose value is made of
 * others' (an `object`, a `list`, a `map`, a `union`) to put in one.
 */
export function PrefControl({ pref, path = '', value, onChange, renderers, fields }: PrefControlProps) {
  return renderPrefControl(
    {
      path,
      pref,
      value: value !== undefined ? value : pref.default,
      setValue: onChange,
      auto: false,
      setAuto: () => {},
      ...(fields ? { fields } : {}),
    },
    renderers,
  );
}
