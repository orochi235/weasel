import '@weasel-js/theme/tokens.css';
import type { CSSProperties } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Select } from '@weasel-js/ui/components/Select';
import s from './Select.module.css';

afterEach(cleanup);

test("a width='fit' trigger sized for a bold value does not cut it", () => {
  const { container } = render(
    <div style={{ '--wzl-select-weight': '700', display: 'inline-block' } as CSSProperties}>
      <Select
        aria-label="Weight"
        width="fit"
        options={[{ value: 'a', label: 'Ab' }, { value: 'w', label: 'Wide wide wide wide' }]}
        defaultSelectedKey="w"
      />
    </div>,
  );
  const value = container.querySelector<HTMLElement>(`.${s.value}`)!;
  expect(getComputedStyle(value).fontWeight).toBe('700');
  expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
});
