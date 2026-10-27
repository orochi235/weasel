import './shell.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { captureHost, storyBox } from './storyMarks';
import { TrialHost } from './TrialHost';

afterEach(cleanup);

// jsdom has no layout, so whether the content box and the scroll offset are the scroller's own is only answerable here.
test("a story host's box follows its scroller through the content, and a capture holds all of it", async () => {
  const hostRef: { current: HTMLElement | null } = { current: null };
  const { findByTestId } = render(
    <div style={{ width: 400, height: 300 }}>
      <TrialHost layout="fullscreen" setup={{}} config={{}} hostRef={hostRef}>
        {() => <div data-testid="story" style={{ width: 400, height: 1200 }} />}
      </TrialHost>
    </div>,
  );
  await findByTestId('story');
  const host = hostRef.current as HTMLElement;
  const scroller = host.querySelector<HTMLElement>('.fg-story__scroll') as HTMLElement;
  expect(scroller.scrollHeight).toBe(1200);

  expect(storyBox(host).content.h).toBe(1200);
  expect(storyBox(host).shown).toMatchObject({ y: 0, h: 300 });
  scroller.scrollTop = 450;
  expect(storyBox(host).shown).toMatchObject({ y: 450, h: 300 });

  const svg = new DOMParser().parseFromString(captureHost(host).markup, 'image/svg+xml').documentElement;
  expect(svg.getAttribute('height')).toBe('1200');
});
