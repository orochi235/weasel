import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Instrument } from '../instrument/types';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { DEFAULT_VIEW } from '../state/view';
import { TrialChrome } from './TrialChrome';

const noop = () => {};

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div className="lk-stub-display">stub experiment area</div>,
};

const record: TrialRecord = {
  id: 'ws-demo',
  instrumentName: 'Stub',
  config: {},
  state: {},
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  undoStack: { past: [], future: [] },
};

function Harness() {
  const store = createLabStore({ storageKey: 'sb', storage: noneAdapter });
  const lab: LabContextValue = {
    instruments: [stub],
    trials: [record],
    addTrial: noop,
    cloneTrial: noop,
    closeTrial: noop,
    resetTrial: noop,
    reorderTrials: noop,
    savedSnapshots: [],
    saveSnapshot: noop,
    loadSnapshot: noop,
    deleteSnapshot: noop,
    mode: 'auto',
    setMode: noop,
  };
  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={lab}>
        <div style={{ height: '500px' }}>
          <TrialChrome trialId="ws-demo" record={record} instrument={stub} isLastTrial={true}>
            {stub.render({
              state: {},
              config: {},
              setState: () => {},
              setConfig: () => {},
              trial: {
                id: 'ws-demo',
                view: DEFAULT_VIEW,
                setView: () => {},
                zoom: 1,
                setZoom: () => {},
                activeToolId: null,
              },
              emit: () => {},
            })}
          </TrialChrome>
        </div>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'labkit/Trial/Trial',
  component: Harness,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Harness>;

export const Default: Story = {};
