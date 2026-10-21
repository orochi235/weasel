import './shell.css';
import { useAssignedPortalContainer } from '@weasel-js/ui/portal-host';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, expect, test } from 'vitest';
import { TrialHost } from './TrialHost';

afterEach(cleanup);

function Scrim() {
  const container = useAssignedPortalContainer();
  return container ? createPortal(<div data-testid="scrim" style={{ position: 'fixed', inset: 0 }} />, container) : null;
}

test('an overlay a tall story portals covers the trial as it stands, however far the story has scrolled', async () => {
  const { container, getByTestId } = render(
    <div style={{ width: 400, height: 300 }}>
      <TrialHost layout="padded" setup={{}} config={{}}>
        {() => (
          <>
            <div style={{ height: 2000 }} />
            <Scrim />
          </>
        )}
      </TrialHost>
    </div>,
  );
  const host = container.querySelector<HTMLElement>('.fg-story')!;
  const scrim = await waitFor(() => getByTestId('scrim'));
  const scroller = [host, ...host.querySelectorAll<HTMLElement>('*')].find((el) => el.scrollHeight > el.clientHeight + 1)!;
  scroller.scrollTop = 1200;

  const trial = host.getBoundingClientRect();
  const covered = scrim.getBoundingClientRect();
  expect({ top: covered.top, height: covered.height }).toEqual({ top: trial.top, height: trial.height });
});
