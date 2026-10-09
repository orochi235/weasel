import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './presentation.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

// jsdom resolves no layout, so whether the content well really fills a trial
// with no sidebar is only checkable here.

afterEach(cleanup);

const Bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="output" />,
};

test('a trial with no sidebar sections gives its whole body to the content', async () => {
  const { container, getByTestId } = render(
    <div className="lk-present-frame">
      <Lab instruments={[Bare]} defaultInstrument="Bare" />
    </div>,
  );
  const body = () =>
    (container.querySelector('.lk-trial__body') as Element).getBoundingClientRect();
  await expect.poll(() => body().width).toBeGreaterThan(0);
  const content = (
    container.querySelector('.lk-trial__content') as Element
  ).getBoundingClientRect();
  expect(content.width).toBe(body().width);
  expect(content.height).toBe(body().height);
  expect(getByTestId('output').getBoundingClientRect().height).toBeGreaterThan(100);
});
