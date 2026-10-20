import { themeValue, type ThemePath } from '@weasel-js/diagram';
import { PropertyField } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import type { ThemeEdit } from './useThemeEdit';

/** A color as the theme keeps it: `#rrggbb` when opaque, else `#rrggbbaa`. */
const stored = (hex: string): string => (/^#[0-9a-f]{8}$/i.test(hex) && hex.slice(7).toLowerCase() === 'ff' ? hex.slice(0, 7) : hex);

/** One theme color, live as it is dragged. */
export function ThemeColor({ edit, path, label }: { edit: ThemeEdit; path: ThemePath; label: string }): ReactElement {
  return (
    <PropertyField
      kind="color" label={label} alpha value={themeValue(edit.theme, path) as string}
      onInput={(hex) => edit.input(path, stored(hex))} onChange={(hex) => edit.commit(path, stored(hex))}
    />
  );
}

const BOX_FIELDS = [['fill', 'Fill'], ['stroke', 'Stroke'], ['text', 'Text']] as const;

/** A box's fill, stroke, and text colors, labeled after `name`. */
export function ThemeBox({ edit, at, name }: { edit: ThemeEdit; at: readonly (string | number)[]; name: string }): ReactElement {
  return (
    <>
      {BOX_FIELDS.map(([field, label]) => (
        <ThemeColor key={field} edit={edit} path={[...at, field] as unknown as ThemePath} label={`${name} ${label.toLowerCase()}`} />
      ))}
    </>
  );
}
