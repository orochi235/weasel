import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { createIndexedDbAdapter } from './adapters';
import { Persistence } from './Persistence';
import { usePersistedState } from './usePersistedState';

// jsdom only has fake-indexeddb, an imitation; this goes through the browser's own.

afterEach(cleanup);

function Tab() {
  const [tab, setTab] = usePersistedState('tab', 'shape');
  return (
    <p>
      <output aria-label="tab">{tab}</output>
      <button type="button" onClick={() => setTab('color')}>
        choose color
      </button>
    </p>
  );
}

const mount = (storage: ReturnType<typeof createIndexedDbAdapter>) =>
  render(
    <Persistence storageKey="test" storage={storage} fallback={<p>loading</p>}>
      <Tab />
    </Persistence>,
  );

test('a value survives a remount through real IndexedDB', async () => {
  const database = `labkit-browser-test-${Date.now()}`;

  const first = mount(createIndexedDbAdapter({ database }));
  await waitFor(() => expect(screen.getByLabelText('tab').textContent).toBe('shape'));
  fireEvent.click(screen.getByText('choose color'));
  await waitFor(() => expect(screen.getByLabelText('tab').textContent).toBe('color'));

  // Unmounting closes the provider, whose deferred close sends the queued write.
  first.unmount();
  await new Promise((r) => setTimeout(r, 100));

  // A fresh adapter, so nothing it reads can come from the first one's memory.
  mount(createIndexedDbAdapter({ database }));
  await waitFor(() => expect(screen.getByLabelText('tab').textContent).toBe('color'), {
    timeout: 3000,
  });
});
