import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { labPrefix } from './labRecords';
import { Persistence } from './Persistence';
import { SingletonExperimentProvider } from './SingletonExperiment';
import { type PersistedStateOptions, usePersistedState } from './usePersistedState';

function Tab({
  name = 'tab',
  label = 'tab',
  options,
}: {
  name?: string | null;
  label?: string;
  options?: PersistedStateOptions;
}) {
  const [value, setValue] = usePersistedState(name, 'shape', options);
  return (
    <>
      <output aria-label={label}>{value}</output>
      <button type="button" onClick={() => setValue('color')}>
        {`set ${label}`}
      </button>
      <button type="button" onClick={() => setValue((prev) => `${prev}+`)}>
        {`append ${label}`}
      </button>
    </>
  );
}

const P = labPrefix('k');
const shown = (label = 'tab') => screen.getByLabelText(label).textContent;

function persisted(backing: Map<string, unknown>, children: React.ReactNode) {
  return (
    <Persistence storageKey="k" storage={createMemoryAdapter(backing)} fallback={<p>loading</p>}>
      {children}
    </Persistence>
  );
}

describe('usePersistedState', () => {
  it('is plain useState with no provider above it', () => {
    render(<Tab />);
    act(() => screen.getByText('set tab').click());
    expect(shown()).toBe('color');
  });

  it('is plain useState, writing nothing, for a null name', async () => {
    const backing = new Map<string, unknown>();
    const view = render(persisted(backing, <Tab name={null} />));
    await screen.findByLabelText('tab');
    act(() => screen.getByText('set tab').click());
    expect(shown()).toBe('color');
    view.unmount();
    await new Promise((r) => setTimeout(r, 20));
    expect(backing.size).toBe(0);
  });

  it('keeps its value across a remount, lab-scoped outside a trial', async () => {
    const backing = new Map<string, unknown>();
    const first = render(persisted(backing, <Tab />));
    expect(screen.getByText('loading')).toBeInTheDocument();
    await screen.findByLabelText('tab');
    expect(shown()).toBe('shape');
    act(() => screen.getByText('set tab').click());
    act(() => screen.getByText('append tab').click());
    expect(shown()).toBe('color+');
    first.unmount();
    await waitFor(() => expect(backing.get(`${P}value:lab:tab`)).toBe('color+'));

    render(persisted(backing, <Tab />));
    await screen.findByLabelText('tab');
    expect(shown()).toBe('color+');
  });

  it('scopes to the trial it is in, unless asked for the lab', async () => {
    const backing = new Map<string, unknown>();
    render(
      <SingletonExperimentProvider
        id="t:1"
        initialConfig={{}}
        initialState={{}}
        storageKey="k"
        storage={createMemoryAdapter(backing)}
      >
        <Tab label="own" />
        <Tab label="shared" name="shared" options={{ scope: 'lab' }} />
      </SingletonExperimentProvider>,
    );
    await screen.findByLabelText('own');
    act(() => screen.getByText('set own').click());
    act(() => screen.getByText('set shared').click());
    await waitFor(() => expect(backing.get(`${P}value:trial:t%3A1:tab`)).toBe('color'));
    await waitFor(() => expect(backing.get(`${P}value:lab:shared`)).toBe('color'));
  });

  it('keeps two components with one name in step', async () => {
    const backing = new Map<string, unknown>();
    render(
      persisted(
        backing,
        <>
          <Tab label="a" />
          <Tab label="b" />
        </>,
      ),
    );
    await screen.findByLabelText('a');
    act(() => screen.getByText('set a').click());
    expect(shown('b')).toBe('color');
  });

  it("re-renders with another tab's write", async () => {
    const backing = new Map<string, unknown>();
    render(persisted(backing, <Tab />));
    await screen.findByLabelText('tab');
    await act(async () => {
      await createMemoryAdapter(backing).set(`${P}value:lab:tab`, 'from elsewhere');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(shown()).toBe('from elsewhere');
  });
});
