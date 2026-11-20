import { createPointerStore } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { DEFAULT_VIEW, LabContext, type LabContextValue, TrialChrome } from '@weasel-js/labkit';
import { createLabStore, LabStoreContext } from '@weasel-js/labkit/state';
import { useState } from 'react';
import { useStore } from 'zustand/react';
import type { Instrument } from '../instrument/types';
import type { TrialRecord } from '../state/types';
import '../frames.stories.less';

const noop = () => {};

const stub: Instrument = {
  name: 'Stub',
  initialState: () => ({}),
  render: () => <div className="lk-stub-display">stub experiment area</div>,
};

const record: TrialRecord = {
  id: 'ws-demo',
  instrumentName: 'Stub',
  config: {},
  state: {},
  view: { zoom: 1, pan: { x: 0, y: 0 } },
};

function seededStore() {
  const store = createLabStore();
  store.getState().addTrial(record);
  return store;
}

function Harness() {
  const [store] = useState(seededStore);
  const live = useStore(store, (s) => s.trials.find((w) => w.id === record.id)) ?? record;
  const lab: LabContextValue = {
    instruments: [stub],
    trials: [live],
    addTrial: noop,
    cloneTrial: noop,
    closeTrial: noop,
    resetTrial: noop,
    reorderTrials: noop,
    swapTrial: noop,
    focusedTrialId: record.id,
    focusTrial: noop,
    savedSnapshots: [],
    saveSnapshot: noop,
    loadSnapshot: noop,
    deleteSnapshot: noop,
    mode: 'auto',
    setMode: noop,
    marks: true,
    setMarks: noop,
    holdMarks: () => noop,
  };
  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={lab}>
        <div className="lk-story-h500">
          <TrialChrome trialId="ws-demo" record={live} instrument={stub} isLastTrial={true}>
            {stub.render({
              state: {},
              config: {},
              setState: () => {},
              setConfig: () => {},
              showConfig: () => {},
              reportAuto: () => {},
              trial: {
                id: 'ws-demo',
                view: DEFAULT_VIEW,
                setView: () => {},
                zoom: 1,
                setZoom: () => {},
                activeToolId: null,
                setActiveTool: () => {},
                setToolShortcuts: () => {},
                visibleLayers: [],
                pointer: createPointerStore(),
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
