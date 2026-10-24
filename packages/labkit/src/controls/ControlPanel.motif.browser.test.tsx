import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

test('a stereo group draws its title in a bar down its left edge, beside its rows', () => {
  const schema = f.schema({
    fade: f
      .group({ rise: f.number(1).label('Rise') })
      .label('Fade')
      .motif(stereo()),
  });
  render(
    <ControlPanel
      schema={resolveConfigSchema(schema)}
      config={schema.defaults() as Record<string, unknown>}
      setConfig={() => {}}
    />,
  );
  const frame = screen.getByRole('group', { name: 'Fade' });
  expect(frame).toHaveAttribute('data-motif', 'stereo');
  expect(frame).toHaveAttribute('data-side', 'left');
  const [bar, body] = Array.from(frame.children) as HTMLElement[];
  expect(bar?.textContent).toContain('Fade');
  expect(body?.contains(screen.getByRole('spinbutton', { name: 'Rise' }))).toBe(true);
  const barBox = (bar as HTMLElement).getBoundingClientRect();
  const bodyBox = (body as HTMLElement).getBoundingClientRect();
  expect(barBox.right).toBeLessThanOrEqual(bodyBox.left + 0.5);
  expect(barBox.height).toBeCloseTo(bodyBox.height, 0);
});
