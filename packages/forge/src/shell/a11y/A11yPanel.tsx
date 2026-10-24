import {
  Button,
  type LabContribution,
  TrialIdContext,
  useLabContext,
  useTrialId,
} from '@weasel-js/labkit';
import num from '@weasel-js/theme/numeric.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { A11yFinding, A11yNode } from '../../protocol/messages';
import { useTrialFrame } from '../trialFrames';

/** Called with the elements an item names while the pointer or focus is on it, and with null when it leaves. */
type Point = (nodes: readonly A11yNode[] | null) => void;

/** Handlers pointing at `nodes` while the pointer or focus is inside the element they are spread on. */
function pointAt(point: Point, nodes: readonly A11yNode[]) {
  const enter = (event: { stopPropagation(): void }) => {
    event.stopPropagation();
    point(nodes);
  };
  return { onMouseOver: enter, onFocus: enter, onMouseLeave: () => point(null), onBlur: () => point(null) };
}

function Finding({ finding, point }: { finding: A11yFinding; point: Point }) {
  return (
    <li className="fg-a11y__finding" {...pointAt(point, finding.nodes)}>
      <p className="fg-a11y__help">
        <a href={finding.helpUrl} target="_blank" rel="noreferrer">
          {finding.help}
        </a>
        {finding.impact ? <span className="fg-a11y__impact" data-impact={finding.impact}>{finding.impact}</span> : null}
      </p>
      <ul className="fg-a11y__nodes">
        {finding.nodes.map((node) => (
          <li key={`${finding.id}:${node.target.join(',')}`} {...pointAt(point, [node])}>
            <code>{node.target.join(' ')}</code>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Findings({ title, findings, point }: { title: string; findings: readonly A11yFinding[]; point: Point }) {
  if (findings.length === 0) return null;
  return (
    <section className="fg-a11y__group">
      <h3 className={`fg-a11y__group-title ${num.numeric}`}>
        {title} ({findings.length})
      </h3>
      <ul className="fg-a11y__findings">
        {findings.map((finding) => (
          <Finding key={finding.id} finding={finding} point={point} />
        ))}
      </ul>
    </section>
  );
}

/** What axe found in the story of the trial this is rendered inside, re-run on demand. */
export function A11yPanel() {
  const trialId = useTrialId();
  const frame = useTrialFrame(trialId);
  const [inFlight, setInFlight] = useState(0);
  const running = inFlight > 0;
  const audit = frame.audit;
  // One automatic run per connected frame, so opening the panel answers without being asked.
  const ran = useRef<typeof audit>(null);

  const start = useCallback((run: NonNullable<typeof audit>) => {
    setInFlight((n) => n + 1);
    void run().finally(() => setInFlight((n) => n - 1));
  }, []);

  useEffect(() => {
    if (!audit || ran.current === audit) return;
    ran.current = audit;
    start(audit);
  }, [audit, start]);

  const send = frame.send;
  const [pointed, setPointed] = useState<readonly A11yNode[] | null>(null);
  useEffect(() => {
    if (!send || !pointed) return;
    send({ type: 'a11y.highlight', targets: pointed.map((node) => node.target) });
    return () => send({ type: 'a11y.highlight', targets: [] });
  }, [send, pointed]);

  const rerun = () => {
    if (audit) start(audit);
  };

  const outcome = frame.a11y;
  return (
    <div className="fg-a11y">
      <div className="fg-a11y__controls">
        <Button size="sm" onClick={rerun} disabled={!audit || running}>
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
          <p className={`fg-a11y__tally ${num.numeric}`}>
            {outcome.report.violations.length} violations · {outcome.report.incomplete.length} to review ·{' '}
            {outcome.report.passes} passes
          </p>
          <Findings title="Violations" findings={outcome.report.violations} point={setPointed} />
          <Findings title="Needs review" findings={outcome.report.incomplete} point={setPointed} />
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

/** The lab aside section showing the focused trial's accessibility audit. */
export const A11Y_SECTION: LabContribution = {
  id: 'fg-a11y',
  region: 'aside',
  item: { title: 'Accessibility', body: <FocusedA11y /> },
};
