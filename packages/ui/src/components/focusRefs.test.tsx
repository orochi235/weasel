import { createRef, type ReactElement, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox/Checkbox';
import { ComboBox } from './ComboBox/ComboBox';
import { Input } from './Input/Input';
import { MenuButton } from './MenuButton/MenuButton';
import { NumberField } from './NumberField/NumberField';
import { UnitField } from './NumberField/UnitField';
import { Select } from './Select/Select';
import { Switch } from './Switch/Switch';
import { TextArea } from './TextArea/TextArea';
import { renderWithIcons } from '../testing/withIcons';

const OPTIONS = [{ value: 'a', label: 'Alpha' }];
const none = (): void => {};

// A control's `ref` reaches the element focus goes to; where a caller needs the box around it, `rootRef` does.
const targets: Array<[string, (ref: RefObject<HTMLElement | null>) => ReactElement, string]> = [
  ['Input', (ref) => <Input aria-label="n" ref={ref as RefObject<HTMLInputElement>} />, 'INPUT'],
  ['TextArea', (ref) => <TextArea aria-label="n" ref={ref as RefObject<HTMLTextAreaElement>} />, 'TEXTAREA'],
  ['NumberField', (ref) => <NumberField aria-label="n" ref={ref as RefObject<HTMLInputElement>} />, 'INPUT'],
  ['UnitField', (ref) => <UnitField aria-label="n" value={1} onChange={none} ref={ref as RefObject<HTMLInputElement>} />, 'INPUT'],
  ['ComboBox', (ref) => <ComboBox aria-label="n" options={OPTIONS} ref={ref as RefObject<HTMLInputElement>} />, 'INPUT'],
  ['Select', (ref) => <Select aria-label="n" options={OPTIONS} ref={ref as RefObject<HTMLButtonElement>} />, 'BUTTON'],
  ['MenuButton', (ref) => <MenuButton label="n" items={OPTIONS} ref={ref as RefObject<HTMLButtonElement>} />, 'BUTTON'],
  ['Checkbox', (ref) => <Checkbox ref={ref as RefObject<HTMLInputElement>}>n</Checkbox>, 'INPUT'],
  ['Switch', (ref) => <Switch ref={ref as RefObject<HTMLInputElement>}>n</Switch>, 'INPUT'],
];

describe.each(targets)('%s ref', (_, make, tag) => {
  it(`reaches the focusable <${tag.toLowerCase()}>`, () => {
    const ref = createRef<HTMLElement>();
    renderWithIcons(make(ref));
    expect(ref.current?.tagName).toBe(tag);
    ref.current!.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});

describe('rootRef', () => {
  it("reaches a Checkbox's label", () => {
    const root = createRef<HTMLLabelElement>();
    const input = createRef<HTMLInputElement>();
    renderWithIcons(<Checkbox ref={input} rootRef={root}>n</Checkbox>);
    expect(root.current?.tagName).toBe('LABEL');
    expect(root.current).toContainElement(input.current);
  });

  it("reaches a Switch's label", () => {
    const root = createRef<HTMLLabelElement>();
    const input = createRef<HTMLInputElement>();
    renderWithIcons(<Switch ref={input} rootRef={root}>n</Switch>);
    expect(root.current?.tagName).toBe('LABEL');
    expect(root.current).toContainElement(input.current);
  });
});

it("Select's id reaches its trigger, for a label outside it", () => {
  renderWithIcons(
    <>
      <label htmlFor="mode">Mode</label>
      <Select id="mode" options={OPTIONS} />
    </>,
  );
  expect(document.getElementById('mode')?.tagName).toBe('BUTTON');
});
