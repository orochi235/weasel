import '../styles.less';
import './useViewPlacement.browser.test.less';
import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { fitStage, Stage } from '../canvas/Stage';
import type { Instrument } from '../instrument/types';
import { useViewPlacement } from './useViewPlacement';

// A stage under a scaled ancestor draws and takes input in its layout px, so
// the box its opening view is fitted to has to be in them too. Only a browser
// applies the transform to the client rect.

afterEach(cleanup);

const CONTENT = { width: 400, height: 400 };
const LAYOUT = { width: 200, height: 100 };

const staged: Instrument = {
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  stage: { size: CONTENT },
};

test('a scaled stage reports its layout size', () => {
  const onResize = vi.fn();
  const { container } = render(
    <div className="lk-test-scaled-stage">
      <Stage
        size={CONTENT}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={() => {}}
        onResize={onResize}
      />
    </div>,
  );
  const stage = container.querySelector<HTMLElement>('.lk-stage');
  expect(stage?.getBoundingClientRect().width).toBe(400);
  expect(onResize).toHaveBeenLastCalledWith(LAYOUT);
});

test('a view placed in a scaled viewport goes home to its layout size', () => {
  const { container } = render(<div className="lk-test-scaled-stage" />);
  const el = container.querySelector<HTMLElement>('.lk-test-scaled-stage');
  const { result } = renderHook(() =>
    useViewPlacement({
      instrument: staged,
      view: null,
      setView: () => {},
      presented: false,
      viewport: { current: el },
    }),
  );
  expect(result.current.home()).toEqual(fitStage(CONTENT, LAYOUT));
});
