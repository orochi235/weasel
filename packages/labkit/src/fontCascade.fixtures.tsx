import { createCamera } from '@weasel-js/kernel3d';
import { type ComponentType, useState } from 'react';
import { Orbit } from './canvas/Orbit';
import { ClockFrames, TrialTransport } from './clock';
import { LabBoundary } from './lab/LabBoundary';

// Components no story mounts outside forge: ClockFrames' story reads forge's playhead, and the rest are pieces a
// lab's own chrome places.

const HOME = createCamera({ distance: 10 });

function Camera() {
  const [view, setView] = useState(HOME);
  return (
    <Orbit view={view} onViewChange={setView} home={() => HOME}>
      <span>Scene</span>
    </Orbit>
  );
}

export const FIXTURES: [string, ComponentType][] = [
  [
    'fixture#ClockFrames',
    () => (
      <ClockFrames aria-label="Frames" spec={{ duration: 1000, loop: true }} every={250}>
        {(elapsed) => <span>{elapsed} ms</span>}
      </ClockFrames>
    ),
  ],
  ['fixture#Orbit', Camera],
  ['fixture#TrialTransport', () => <TrialTransport trialId="none" />],
  [
    'fixture#LabBoundary',
    () => (
      <LabBoundary>
        <span>Inside a boundary</span>
      </LabBoundary>
    ),
  ],
];
