import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { openPointerSession, type PointerSessionCallbacks } from './pointerSession';
import s from './pointerSession.browser.test.module.css';

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(800, 600);
});

function Origin({ cb }: { cb: PointerSessionCallbacks }) {
  const [shown, setShown] = useState(true);
  return (
    <>
      {shown && (
        <div
          data-testid="origin"
          className={s.box}
          onPointerDown={(e) => {
            openPointerSession(e.currentTarget, e.nativeEvent, { ...cb, onMove: () => { setShown(false); } });
          }}
        />
      )}
      <div data-testid="elsewhere" className={s.box} />
    </>
  );
}

// Chrome sends the `lostpointercapture` for a captured element taken out of the document to the document.
it('cancels a session whose origin leaves the document mid-drag', async () => {
  const onEnd = vi.fn();
  const onCancel = vi.fn();
  render(<Origin cb={{ onEnd, onCancel }} />);
  await userEvent.dragAndDrop(screen.getByTestId('origin'), screen.getByTestId('elsewhere'));
  expect(onCancel.mock.calls).toEqual([['lostcapture']]);
  expect(onEnd).not.toHaveBeenCalled();
});
