import { describe, expect, it } from 'vitest';
import { type NamedFrame, waitForOwnFrame } from './vitest-own-frame.ts';

const PATH = '/repo/packages/x/src/a b.browser.test.tsx';
const frameOf = (path: string, detached = false): NamedFrame => ({
  url: () => `http://localhost:63315/?sessionId=s1&iframeId=${encodeURIComponent(path)}`,
  isDetached: () => detached,
});

/** A page whose name lookup answers `answers` in turn, then the last one for good. */
function pageAnswering(...answers: (NamedFrame | null)[]) {
  let calls = 0;
  return {
    frame: (name: string) => {
      expect(name).toBe('vitest-iframe');
      return answers[Math.min(calls++, answers.length - 1)]!;
    },
    calls: () => calls,
  };
}

describe('waitForOwnFrame', () => {
  it('returns at once when the lookup already finds this file\'s frame', async () => {
    const page = pageAnswering(frameOf(PATH));
    await waitForOwnFrame(page, PATH);
    expect(page.calls()).toBe(1);
  });

  it('waits out the previous file\'s frame, detached or not, and a missing one', async () => {
    const page = pageAnswering(frameOf('/repo/other.browser.test.tsx'), frameOf(PATH, true), null, frameOf(PATH));
    await waitForOwnFrame(page, PATH, { stepMs: 1 });
    expect(page.calls()).toBe(4);
  });

  it('gives up with the frame it kept finding', async () => {
    const page = pageAnswering(frameOf('/repo/other.browser.test.tsx'));
    await expect(waitForOwnFrame(page, PATH, { timeoutMs: 20, stepMs: 1 })).rejects.toThrow(/other\.browser\.test\.tsx/);
  });
});
