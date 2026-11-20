import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { trialPictures, useTrialPicture } from './trialPictures';

it("releases a trial's picture once the trial unmounts", () => {
  const p = trialPictures();
  const { result, unmount } = renderHook(() => useTrialPicture(p, 't1'));
  // The targets callback asks for the same element the trial renders into.
  expect(p.pictureFor('t1')).toBe(result.current);
  expect(p.pictures.size).toBe(1);
  unmount();
  expect(p.pictures.size).toBe(0);
});
