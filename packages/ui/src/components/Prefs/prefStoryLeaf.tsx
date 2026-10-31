import type { ReactNode } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { PropertyControl } from '@weasel-js/ui/components/Properties';
import { prefFieldProps, withRowControl } from '@weasel-js/ui/components/Prefs';

/** One schema leaf drawn as the control a form draws for it, for the stories of the parts that take a leaf renderer. */
export function prefStoryLeaf(leaf: PrefLeaf, value: unknown, set: (next: unknown) => void, name: string, disabled?: boolean): ReactNode {
  const field = prefFieldProps(leaf, { value, setValue: set, disabled });
  return field && <PropertyControl {...withRowControl(field, 'form')} name={name} />;
}
