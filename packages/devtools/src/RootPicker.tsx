import type { ReactElement } from 'react';
import type { DevtoolsRootInfo } from '@weasel-js/core/devtools';
import { Select } from '@weasel-js/ui/components/Select';
import s from './DevtoolsPanel.module.css';

export interface RootPickerProps {
  roots: readonly DevtoolsRootInfo[];
  value: string | null;
  onChange(rootId: string): void;
}

/** Which canvas the panel reads, each named by its label and dimension. */
export function RootPicker({ roots, value, onChange }: RootPickerProps): ReactElement {
  return (
    <Select
      className={s.picker}
      aria-label="Canvas"
      width="fit"
      placeholder="No canvas"
      isDisabled={roots.length === 0}
      selectedKey={value}
      onSelectionChange={onChange}
      options={roots.map((r) => ({
        value: r.id,
        textValue: `${r.label} ${r.dimension}`,
        label: <>{r.label} <span className={s.dimension}>{r.dimension}</span></>,
      }))}
    />
  );
}
