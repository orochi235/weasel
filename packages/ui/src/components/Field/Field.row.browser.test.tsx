import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Field } from '@weasel-js/ui/components/Field';
import { Input } from '@weasel-js/ui/components/Input';
import { UnitField } from '@weasel-js/ui/components/NumberField';

// Flex sizing is layout, which jsdom does not do.

afterEach(cleanup);

const none = (): void => {};

/** Whether the label sits on one line at its own width, rather than squeezed beside its control. */
function expectWhole(label: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(label);
  expect(label.getBoundingClientRect().width).toBeGreaterThanOrEqual(range.getBoundingClientRect().width - 0.5);
  expect(range.getClientRects()).toHaveLength(1);
}

describe('a row Field', () => {
  test('keeps its label whole beside an Input filling the row', () => {
    render(<div style={{ width: 320 }}><Field orientation="row" label="Page size"><Input /></Field></div>);
    expectWhole(screen.getByText('Page size'));
  });

  test('keeps its label whole beside a group of UnitFields', () => {
    render(
      <div style={{ width: 320 }}>
        <Field orientation="row" label="Page size" group>
          <UnitField aria-label="Width" value={210} onChange={none} />
          <UnitField aria-label="Height" value={297} onChange={none} />
        </Field>
      </div>,
    );
    expectWhole(screen.getByText('Page size'));
  });
});
