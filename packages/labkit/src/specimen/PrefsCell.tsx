import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import { useState } from 'react';
import { Cell } from './Cell';

const PREFS: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Draw a grid behind the scene.',
          default: true,
        },
        zoomStep: {
          kind: 'number',
          name: 'Zoom step',
          description: 'Percent the zoom controls move per click.',
          default: 10,
          min: 1,
          max: 50,
        },
        format: {
          kind: 'enum',
          name: 'Format',
          description: 'File type for exported images.',
          default: 'svg',
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
          ],
        },
      },
    },
  },
};

function setAt(
  values: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return values;
  if (rest.length === 0) return { ...values, [head]: value };
  const inner = ((Object.hasOwn(values, head) && values[head]) || {}) as Record<string, unknown>;
  return { ...values, [head]: setAt(inner, rest.join('.'), value) };
}

export function PrefsCell() {
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  return (
    <Cell label="PrefsForm">
      <PrefsForm
        schema={PREFS}
        values={prefs}
        onChange={(path, value) => setPrefs((prev) => setAt(prev, path, value))}
      />
    </Cell>
  );
}
