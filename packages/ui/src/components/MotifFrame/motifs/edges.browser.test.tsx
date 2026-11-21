import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { cssColorLiteral } from '@weasel-js/paint';
import type { CSSProperties } from 'react';
import { afterEach, expect, it } from 'vitest';
import { MotifFrame, sheet, stereo, well } from '@weasel-js/ui/components/MotifFrame';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';

// Which side an edge lands on under a writing direction is a cascade question only a browser answers.

afterEach(cleanup);

const group = (name: string) => screen.getByRole('group', { name });

it('draws a tinted rule frame’s edge at the start of the line, in either direction', () => {
  render(
    <>
      <div dir="ltr">
        <MotifFrame title="Ltr" tint={cssColorLiteral('rgb(200, 0, 0)')}>
          x
        </MotifFrame>
      </div>
      <div dir="rtl">
        <MotifFrame title="Rtl" tint={cssColorLiteral('rgb(200, 0, 0)')}>
          x
        </MotifFrame>
      </div>
    </>,
  );
  expect(getComputedStyle(group('Ltr')).borderLeftWidth).toBe('4px');
  expect(getComputedStyle(group('Rtl')).borderRightWidth).toBe('4px');
  expect(getComputedStyle(group('Rtl')).borderLeftWidth).not.toBe('4px');
});

it('blurs behind a panel given a blur, but not behind a sheet frame inside it', () => {
  render(
    <div style={{ '--wzl-panel-blur': '3px', '--wzl-panel-title-inset': '0 7px' } as CSSProperties}>
      <PropertyPanel title="Blurred">
        <MotifFrame title="Plain" motif={sheet()}>
          x
        </MotifFrame>
      </PropertyPanel>
    </div>,
  );
  expect(getComputedStyle(group('Blurred')).backdropFilter).toBe('blur(3px)');
  expect(getComputedStyle(group('Plain')).backdropFilter).toBe('none');
  expect(getComputedStyle(screen.getByRole('heading', { name: 'Plain' })).paddingInlineStart).toBe('0px');
});

it('sets a well’s title as a label without setting the titles of wells inside it', () => {
  render(
    <MotifFrame title="Outer" motif={well({ label: 'wider' })}>
      <MotifFrame title="Inner" motif={well()}>
        x
      </MotifFrame>
    </MotifFrame>,
  );
  const heading = (name: string) => screen.getByRole('heading', { name });
  expect(getComputedStyle(heading('Outer')).textTransform).toBe('uppercase');
  expect(getComputedStyle(heading('Inner')).textTransform).toBe('none');
});

it.each(['left', 'right'] as const)('runs a %s stereo bar along that edge, with the body’s extra room beside it, under rtl', (side) => {
  render(
    <div dir="rtl" style={{ width: 240 }}>
      <MotifFrame title="Jacks" motif={stereo({ side })}>
        <div style={{ height: 40 }} />
      </MotifFrame>
    </div>,
  );
  const frame = group('Jacks');
  const bar = document.getElementById(frame.getAttribute('aria-labelledby')!)!.parentElement!;
  const body = frame.lastElementChild as HTMLElement;
  const [barBox, bodyBox] = [bar.getBoundingClientRect(), body.getBoundingClientRect()];
  if (side === 'left') expect(barBox.right).toBeLessThanOrEqual(bodyBox.left + 1);
  else expect(barBox.left).toBeGreaterThanOrEqual(bodyBox.right - 1);
  const inset = getComputedStyle(body)[side === 'left' ? 'borderLeftWidth' : 'borderRightWidth'];
  expect(parseFloat(inset)).toBeGreaterThan(0);
});
