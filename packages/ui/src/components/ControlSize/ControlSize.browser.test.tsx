import '@weasel-js/theme/tokens.css';
import { applyTheme, weaselTheme } from '@weasel-js/theme';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Button } from '@weasel-js/ui/components/Button';
import { ControlSizeScope, type ControlSize } from '@weasel-js/ui/components/ControlSize';
import { Input } from '@weasel-js/ui/components/Input';
import { NumberField, UnitField } from '@weasel-js/ui/components/NumberField';
import { Select } from '@weasel-js/ui/components/Select';
import { PropertyList } from '@weasel-js/ui/components/Properties';

// A row of a button, a select, a text field and two numeric fields stands at one height: the theme's density says
// how many pixels each size is, the size each control takes comes from its own `size`, else the nearest scope.

let release: (() => void) | undefined;
afterEach(() => {
  cleanup();
  release?.();
  release = undefined;
  document.querySelectorAll('[data-test-host]').forEach((el) => el.remove());
});

const OPTIONS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];
const DENSITIES = ['compact', 'comfortable', 'roomy'] as const;
const TOKEN: Record<ControlSize, string> = { sm: '--wzl-control-h-sm', md: '--wzl-control-h' };

function Row({ size }: { size?: ControlSize }) {
  return (
    <>
      <Button size={size}>Go</Button>
      <Select aria-label="Pick" options={OPTIONS} defaultSelectedKey="a" size={size} />
      <Input aria-label="Name" defaultValue="Pico" size={size} />
      <NumberField aria-label="Count" defaultValue={3} size={size} />
      <UnitField aria-label="Width" value={12} onChange={() => {}} size={size} />
    </>
  );
}

function mount(density: (typeof DENSITIES)[number], children: ReactNode) {
  const host = document.createElement('div');
  host.setAttribute('data-test-host', '');
  document.body.append(host);
  release = applyTheme(host, weaselTheme, { mode: 'light', density });
  render(<>{children}</>, { container: host });
  return host;
}

const px = (host: Element, token: string) => Number.parseFloat(getComputedStyle(host).getPropertyValue(token));
const heightOf = (el: Element) => el.getBoundingClientRect().height;

/** The drawn heights of the row's controls, by name. */
function heights() {
  return {
    button: heightOf(screen.getByRole('button', { name: 'Go' })),
    select: heightOf(screen.getByRole('button', { name: /Pick/ })),
    text: heightOf(screen.getByRole('textbox', { name: 'Name' }).parentElement!),
    number: heightOf(screen.getByRole('spinbutton', { name: 'Count' }).parentElement!),
    unit: heightOf(screen.getByRole('spinbutton', { name: 'Width' }).parentElement!),
  };
}

function expectAll(got: Record<string, number>, want: number) {
  for (const [name, h] of Object.entries(got)) expect.soft(h, name).toBeCloseTo(want, 0);
}

describe.each(DENSITIES)('at %s density', (density) => {
  test.each(['sm', 'md'] as const)('a %s scope sets every control in a row to that size', (size) => {
    const host = mount(density, <ControlSizeScope size={size}><Row /></ControlSizeScope>);
    expectAll(heights(), px(host, TOKEN[size]));
  });

  test.each(['sm', 'md'] as const)("every control's own %s size draws at the same height, unscoped", (size) => {
    const host = mount(density, <Row size={size} />);
    expectAll(heights(), px(host, TOKEN[size]));
  });

  test('a nearer scope wins over an outer one', () => {
    const host = mount(density, (
      <ControlSizeScope size="sm"><ControlSizeScope size="md"><Row /></ControlSizeScope></ControlSizeScope>
    ));
    expectAll(heights(), px(host, TOKEN.md));
  });

  test("a control's own size wins over its scope", () => {
    const host = mount(density, <ControlSizeScope size="sm"><Row size="md" /></ControlSizeScope>);
    expectAll(heights(), px(host, TOKEN.md));
  });

  test('one control sized against its scope stands apart, and the rest keep the scope', () => {
    const host = mount(density, (
      <ControlSizeScope size="sm">
        <Button>Go</Button>
        <Select aria-label="Pick" options={OPTIONS} defaultSelectedKey="a" size="md" />
        <Input aria-label="Name" />
        <NumberField aria-label="Count" defaultValue={3} />
        <UnitField aria-label="Width" value={12} onChange={() => {}} />
      </ControlSizeScope>
    ));
    const { select, ...rest } = heights();
    expect(select).toBeCloseTo(px(host, TOKEN.md), 0);
    expectAll(rest, px(host, TOKEN.sm));
  });

  test('a compact bar holds the whole row at one height', () => {
    mount(density, <Bar label="Tools" size="sm"><Row /></Bar>);
    const got = heights();
    expectAll(got, got.button);
  });

  test('a scope inside a property list overrides the spacing’s field height', () => {
    const host = mount(density, (
      <PropertyList spacing="tight"><ControlSizeScope size="md"><Row /></ControlSizeScope></PropertyList>
    ));
    expectAll(heights(), px(host, TOKEN.md));
  });
});

test('the sizes scale with the theme density', () => {
  const at = (density: (typeof DENSITIES)[number]) => {
    mount(density, <ControlSizeScope size="md"><Row /></ControlSizeScope>);
    const h = heights().text;
    cleanup();
    release?.();
    release = undefined;
    return h;
  };
  const [compact, comfortable, roomy] = DENSITIES.map(at);
  expect(compact).toBeLessThan(comfortable!);
  expect(comfortable).toBeLessThan(roomy!);
});
