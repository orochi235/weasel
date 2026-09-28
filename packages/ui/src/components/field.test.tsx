import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ComboBox } from './ComboBox/ComboBox';
import { Field, fieldClasses } from './Field/Field';
import { Input } from './Input/Input';
import { ListEditor } from './ListEditor/ListEditor';
import { MenuButton } from './MenuButton/MenuButton';
import { NumberField } from './NumberField/NumberField';
import { UnitField } from './NumberField/UnitField';
import { Select } from './Select/Select';
import f from './field.module.css';

// CSS modules are not processed in the `weasel-ui` vitest project, so these
// assert the contract — which shared classes each control wears — and read the
// stylesheet for the rules those classes key off. The pixels are a browser check.
const css = readFileSync(resolve(__dirname, 'field.module.css'), 'utf8');
const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

type Orientation = 'stacked' | 'row';
const controls: Array<[string, (o: Orientation) => ReactElement]> = [
  ['Input', (o) => <Input label="Name" orientation={o} description="Help" />],
  ['NumberField', (o) => <NumberField label="Name" orientation={o} description="Help" />],
  ['Select', (o) => <Select label="Name" orientation={o} description="Help" options={OPTIONS} />],
  ['ComboBox', (o) => <ComboBox label="Name" orientation={o} description="Help" options={OPTIONS} />],
];

const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '').split(' ');

describe('shared field layout', () => {
  describe.each(controls)('%s', (_, make) => {
    it('stacks the label above the frame by default', () => {
      render(make('stacked'));
      const root = screen.getByText('Name').closest(`.${f.control}`);
      expect(classesOf(root)).toContain(f.field);
      expect(classesOf(root)).not.toContain(f.row);
    });

    it("sets the label beside the frame with orientation='row'", () => {
      const { container } = render(make('row'));
      const root = screen.getByText('Name').closest(`.${f.control}`);
      expect(classesOf(root)).toContain(f.row);
      expect(classesOf(screen.getByText('Name'))).toContain(f.label);
      expect(classesOf(screen.getByText('Help'))).toEqual(expect.arrayContaining([f.hint, f.below]));
      expect(root?.querySelector(`.${f.frame}`)).not.toBeNull();
      expect(container.querySelectorAll(`.${f.frame}`)).toHaveLength(1);
      expect(screen.getAllByLabelText('Name').length).toBeGreaterThan(0);
    });
  });

  it('shares its label, hint and error classes with Field', () => {
    expect(fieldClasses).toEqual({ root: f.field, row: f.row, label: f.label, hint: f.hint, error: f.error });
    const { container } = render(<Field orientation="row" />);
    expect(classesOf(container.firstElementChild)).toEqual(expect.arrayContaining([f.field, f.row]));
  });

  it('keeps the label at its own width beside the frame, and wraps the slots below', () => {
    // (0,3,0), so Field's own `.row .label { flex: 1 }` cannot win on source order.
    expect(css).toMatch(/\.control\.row \.label\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).toMatch(/\.control\.row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.control\.row \.below\s*\{[^}]*flex-basis:\s*100%/);
    expect(css).toMatch(/\.control\.row:not\(\.fit\) \.frame\s*\{[^}]*flex:\s*1 1 0/);
  });
});

describe('shared field frame', () => {
  it('is worn by UnitField, MenuButton and each ListEditor input', () => {
    const { container } = render(
      <>
        <UnitField aria-label="Size" value={1} onChange={() => {}} />
        <MenuButton label="Pick one" items={OPTIONS} onAction={() => {}} />
        <ListEditor aria-label="Glob" value={['x', 'y']} onChange={() => {}} />
      </>,
    );
    expect(classesOf(screen.getByRole('button', { name: /Pick one/ }))).toContain(f.frame);
    expect(classesOf(screen.getByRole('textbox', { name: 'Glob 1' }))).toContain(f.frame);
    expect(classesOf(screen.getByRole('spinbutton', { name: 'Size' }).parentElement)).toContain(f.frame);
    expect(container.querySelectorAll(`.${f.frame}`)).toHaveLength(4);
  });

  it('rings a text frame on any focus and a button frame only on keyboard focus', () => {
    expect(css).toMatch(/\.frame:focus-within:not\(button\),\s*\.frame\[data-focus-visible\]\s*\{/);
  });
});
