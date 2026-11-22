import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import * as stories from './SegmentedBar.stories';

afterEach(cleanup);

type Renderable = { args?: Record<string, unknown>; render?: (args: Record<string, unknown>, ctx: never) => React.ReactNode };

const named = Object.entries(stories).filter(([key]) => key !== 'default') as [string, Renderable][];

test.each(named.filter(([, story]) => story.render))('the %s story names every bar it renders', (_, story) => {
  const Story = () => <>{story.render!({ ...story.args }, {} as never)}</>;
  const { container } = render(<Story />);
  const bars = [...container.querySelectorAll('[role="radiogroup"], [role="group"], [role="toolbar"]')];
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) expect(bar).toHaveAccessibleName();
});
