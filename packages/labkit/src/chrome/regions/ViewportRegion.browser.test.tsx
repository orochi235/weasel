import '@weasel-js/theme/tokens.css';
import '../../styles.less';
import './ViewportRegion.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ZoomControl } from '../../primitives/ZoomControl';
import type { TrialChromeContext, TrialContribution } from '../types';
import { ViewportRegion } from './ViewportRegion';

// Whether a rendered control shrinks to the cluster or runs out past it is
// layout, which only a real browser has.

afterEach(cleanup);

const ctx = { zoom: 1, setZoom: () => {} } as unknown as TrialChromeContext;

const contributions: TrialContribution[] = [
  {
    id: 'zoom-control',
    region: 'viewport',
    render: (c) => <ZoomControl zoom={c.zoom ?? 1} onZoomChange={c.setZoom} />,
  },
];

test('a zoom control on its own row shrinks its slider to fit a narrow well', () => {
  const { container } = render(
    <div className="lk-root">
      <div className="lk-viewport-test-well">
        <ViewportRegion contributions={contributions} ctx={ctx} />
      </div>
    </div>,
  );
  const cluster = container.querySelector('.lk-viewport-controls')?.getBoundingClientRect();
  const zoom = container.querySelector('.lk-zoom')?.getBoundingClientRect();
  if (!cluster || !zoom) throw new Error('nothing rendered');
  expect(zoom.left).toBeGreaterThanOrEqual(cluster.left);
  expect(zoom.right).toBeLessThanOrEqual(cluster.right);
});
