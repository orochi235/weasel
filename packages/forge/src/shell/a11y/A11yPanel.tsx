import {
  Button,
  type LabContribution,
  TrialIdContext,
  useLabContext,
  useTrialId,
} from '@weasel-js/labkit';
import { useEffect, useRef, useState } from 'react';
import type { A11yFinding } from '../../protocol/messages';
import { useTrialFrame } from '../trialFrames';

function Finding({ finding }: { finding: A11yFinding }) {
  return (
    <li className="fg-a11y__finding">
      <p className="fg-a11y__help">
        <a href={finding.helpUrl} target="_blank" rel="noreferrer">
          {finding.help}
        </a>
        {finding.impact ? <span className="fg-a11y__impact" data-impact={finding.impact}>{finding.impact}</span> : null}
      </p>
      <ul className="fg-a11y__nodes">
        {finding.nodes.map((node) => (
          <li key={`${finding.id}:${node.target.join(',')}`}>
            <code>{node.target.join(' ')}</code>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Findings({ title, findings }: { title: string; findings: readonly A11yFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <section className="fg-a11y__group">
      <h3 className="fg-a11y__group-title">
        {title} ({findings.length})
      </h3>
      <ul className="fg-a11y__findings">
        {findings.map((finding) => (
          <Finding key={finding.id} finding={finding} />
        ))}
      </ul>
    </section>
  );
}

/** What axe found in the story of the trial this is rendered inside, re-run on demand. */
export function A11yPanel() {
  const trialId = useTrialId();
  const frame = useTrialFrame(trialId);
  const [running, setRunning] = useState(false);
  const audit = frame.audit;
  // One automatic run per connected frame, so opening the panel answers without being asked.
  const ran = useRef<typeof audit>(null);

  useEffect(() => {
    if (!audit || ran.current === audit) return;
    ran.current = audit;
    setRunning(true);
    void audit().finally(() => setRunning(false));
  }, [audit]);

  const rerun = () => {
    if (!audit) return;
    setRunning(true);
    void audit().finally(() => setRunning(false));
  };

  const outcome = frame.a11y;
  return (
    <div className="fg-a11y">
      <div className="fg-a11y__controls">
        <Button size="sm" variant="secondary" onClick={rerun} disabled={!audit || running}>
          {running ? 'Checking…' : 'Re-check'}
        </Button>
      </div>
      {!audit ? <p className="fg-a11y__note">No frame is connected.</p> : null}
      {audit && !outcome ? <p className="fg-a11y__note">{running ? 'Running axe…' : 'Not checked yet.'}</p> : null}
      {outcome && !outcome.ok ? (
        <p className="fg-a11y__note" role="alert">
          axe could not run: {outcome.message}
        </p>
      ) : null}
      {outcome?.ok ? (
        <>
          <p className="fg-a11y__tally">
            {outcome.report.violations.length} violations · {outcome.report.incomplete.length} to review ·{' '}
            {outcome.report.passes} passes
          </p>
          <Findings title="Violations" findings={outcome.report.violations} />
          <Findings title="Needs review" findings={outcome.report.incomplete} />
        </>
      ) : null}
    </div>
  );
}

/** The panel for the lab's focused trial, rendered as though inside that trial. */
function FocusedA11y() {
  const { focusedTrialId, trials, instruments } = useLabContext();
  const record = trials.find((trial) => trial.id === focusedTrialId);
  if (!record) return null;
  const instrument = instruments.find((i) => i.name === record.instrumentName);
  return (
    <section className="fg-a11y-focus" aria-label="Accessibility">
      <p className="fg-a11y__trial">{record.title ?? instrument?.title ?? record.instrumentName}</p>
      <TrialIdContext.Provider value={record.id}>
        <A11yPanel />
      </TrialIdContext.Provider>
    </section>
  );
}

export const A11Y_SECTION: LabContribution = {
  id: 'fg-a11y',
  region: 'aside',
  item: { title: 'Accessibility', body: <FocusedA11y /> },
};
