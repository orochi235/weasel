import '@weasel-js/theme/tokens.css';
import type { CSSProperties } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { KeyDiagram, ansiLayout } from '@weasel-js/ui/components/Keycaps';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

const keyBox = (unit: string | undefined, layout: boolean) => {
  const { container } = renderWithIcons(
    <div style={(unit ? { '--key-diagram-unit': unit } : {}) as CSSProperties}>
      {layout ? <KeyDiagram layout={ansiLayout('windows')} keys={['KeyA', 'F1']} /> : <KeyDiagram keys={['KeyA', 'F1']} />}
    </div>,
  );
  const [a, f1] = [...container.querySelectorAll('[data-code] > kbd')] as HTMLElement[];
  return { height: a!.getBoundingClientRect().height, font: parseFloat(getComputedStyle(a!).fontSize), fnFont: parseFloat(getComputedStyle(f1!).fontSize) };
};

it.each([true, false])('scales its keys and their legends with --key-diagram-unit (layout: %s)', (layout) => {
  const base = keyBox(undefined, layout);
  cleanup();
  const big = keyBox('44px', layout);
  expect(base.height).toBeCloseTo(22, 0);
  expect(big.height).toBeCloseTo(44, 0);
  expect(big.font / base.font).toBeCloseTo(2, 1);
  expect(big.fnFont / base.fnFont).toBeCloseTo(2, 1);
});
