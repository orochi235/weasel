import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { CustomKinds } from './kindSchemas';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const KINDS: CustomKinds = {
  lookup: {
    source: { kind: 'string', name: 'Source', description: '', default: 'tools', required: true },
    hint: { kind: 'string', name: 'Hint', description: '', default: '' },
  },
};

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      tool: { kind: 'lookup', name: 'Tool', description: '', default: 'pen', source: 'tools', hint: 'pick one' } as PrefLeaf,
      flag: { kind: 'boolean', name: 'Flag', description: '', default: false },
    } },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} kinds={KINDS} />;
}

const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));
const select = (key: string) => fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(`(${key})`));
const leaf = (key: string) => (latest.children.view as PrefGroup).children[key] as unknown as Record<string, unknown>;

describe('PrefSchemaEditor custom kinds', () => {
  it('keeps a required attribute that is emptied, and removes an optional one', () => {
    render(<Live />);
    select('tool');
    fireEvent.change(attributes().getByRole('textbox', { name: 'Source' }), { target: { value: '' } });
    expect(leaf('tool').source).toBe('');
    fireEvent.change(attributes().getByRole('textbox', { name: 'Hint' }), { target: { value: '' } });
    expect('hint' in leaf('tool')).toBe(false);
  });

  it('gives a leaf switched to the kind its required attributes', () => {
    render(<Live />);
    select('flag');
    fireEvent.click(attributes().getByRole('button', { name: /^(?!About ).*Kind/ }));
    fireEvent.click(screen.getByRole('option', { name: 'lookup' }));
    expect(leaf('flag')).toMatchObject({ kind: 'lookup', source: 'tools' });
  });
});
