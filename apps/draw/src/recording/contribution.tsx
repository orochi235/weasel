/**
 * Input recording as one `<SceneCanvas ambient>` entry: `attach` binds the
 * session to the mounted canvas, and Record and Play are actions the command
 * bar draws from the registry.
 */

// Side-effect import: augments DepSchema with `recording`.
import './depSchemaAugmentation';

import { ActionDisabledReason, type Action, type ActionDeps, type SurfaceContribution } from '@weasel-js/core';
import { RECORD_KEY, type RecordingSession } from './session';
import { icon } from '../icons.gen';

const read = (deps?: ActionDeps): RecordingSession | undefined => deps?.recording;

type RecordingAction = Action & { requires: ['recording'] };

const recordAction: RecordingAction = {
  id: 'record.toggle',
  label: 'Record input',
  icon: icon('record'),
  group: 'record',
  defaultBinding: { kind: 'key', key: RECORD_KEY },
  requires: ['recording'],
  active: (deps) => read(deps)?.recording === true,
  enabled: (deps) => read(deps)?.playing !== true || ActionDisabledReason.NotApplicable,
  invoker: { timing: 'immediate', run: (deps) => { void read(deps)?.toggle(); } },
};

const playAction: RecordingAction = {
  id: 'record.play',
  label: 'Play recording',
  icon: icon('playRecording'),
  group: 'record',
  requires: ['recording'],
  enabled: (deps) => {
    const session = read(deps);
    return (!!session && !session.recording && !session.playing) || ActionDisabledReason.NotApplicable;
  },
  invoker: { timing: 'immediate', run: (deps) => { void read(deps)?.play(); } },
};

export function recordingContribution(session: RecordingSession): SurfaceContribution {
  return {
    id: 'draw.recording',
    eligibility: { always: true },
    actions: [recordAction, playAction],
    deps: { recording: () => session },
    attach: (api) => session.attach(() => api.surface),
  };
}
