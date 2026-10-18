import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

const pinToggle = (name: string) => screen.queryByRole('button', { name: `Pin ${name}` });

describe('<ControlPanel> auto is opt-in', () => {
  it('gives a leaf that never said auto a plain label, whatever its kind', () => {
    const schema = f.schema({
      on: f.boolean(true).label('On'),
      title: f.string('x').label('Title'),
      size: f.number(1).label('Size'),
      tint: f.color('#ffffff').label('Tint'),
      mode: f.enum('a', ['a', 'b']).label('Mode'),
    });
    render(
      <ControlPanel schema={resolveConfigSchema(schema, [])} config={schema.defaults()} setConfig={() => {}} />,
    );
    for (const name of ['On', 'Title', 'Size', 'Tint', 'Mode']) expect(pinToggle(name)).toBeNull();
  });

  it('toggles a leaf that said .auto(), with or without a resolver, or .initial(auto)', () => {
    const schema = f.schema({
      a: f.number(1).auto().label('Bare'),
      b: f.number(1).auto(() => 2).label('Resolved'),
      c: f.string('x').initial(auto).label('Opened'),
    });
    render(
      <ControlPanel schema={resolveConfigSchema(schema, [])} config={schema.defaults()} setConfig={() => {}} />,
    );
    expect(pinToggle('Bare')).not.toBeNull();
    expect(pinToggle('Resolved')).not.toBeNull();
  });

  it('has no .manual(): never-auto is the default, so there is nothing to opt out of', () => {
    expect('manual' in f.number(1)).toBe(false);
  });
});
