import { Button } from '@weasel-js/ui/components/Button';
import { type RefObject, useState } from 'react';
import { useAnnotations } from '../AnnotationsContext';
import type { Annotation, AnnotationsApi } from '../types';
import { type CalibrationConfig, pxPerUnit } from './condition';
import { CONTENT, EXERCISES } from './exercises';
import { type ExerciseScore, scoreAll } from './score';

export const PICTURE_TARGET = 'picture';

/** The marks made under this condition: a stale one was made under another and describes a different picture. */
export function freshMarks(api: AnnotationsApi, config: CalibrationConfig): Annotation[] {
  return api.query({ target: PICTURE_TARGET }).filter((m) => !api.isStale(m, config));
}

/** Everything a review needs to replay the run: the marks, how they scored, and what they were drawn on. */
export function calibrationReport(
  api: AnnotationsApi,
  config: CalibrationConfig,
  scores: readonly ExerciseScore[],
  picture: HTMLElement | null,
) {
  const r = picture?.getBoundingClientRect();
  return {
    condition: config,
    pxPerUnit: pxPerUnit(config),
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
    target: {
      id: PICTURE_TARGET,
      content: CONTENT,
      clientRect: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
    },
    scores,
    annotations: api.toJSON(),
  };
}

const px = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(2));

function Row({ instruction, score }: { instruction: string; score: ExerciseScore }) {
  return (
    <tr className="lk-cal__row" data-exercise={score.id} data-status={score.status}>
      <th scope="row" className="lk-cal__instruction" title={score.reason}>
        {instruction}
      </th>
      <td className={`lk-cal__status lk-cal__status--${score.status}`}>{score.status}</td>
      <td className="lk-cal__num">{px(score.errorPx)}</td>
      <td className="lk-cal__num">{px(score.maxPx)}</td>
    </tr>
  );
}

type Copied = 'copied' | 'failed' | null;

/** One row per exercise — its status and error in screen px — and a button copying the whole run as JSON. */
export function CalibrationResults({
  config,
  picture,
}: {
  config: CalibrationConfig;
  picture: RefObject<HTMLElement | null>;
}) {
  const api = useAnnotations();
  const scores = scoreAll(EXERCISES, freshMarks(api, config), CONTENT, pxPerUnit(config));
  const [copied, setCopied] = useState<Copied>(null);
  const passed = scores.filter((s) => s.status === 'pass').length;

  const copy = () => {
    const report = calibrationReport(api, config, scores, picture.current);
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(
      () => setCopied('copied'),
      () => setCopied('failed'),
    );
  };

  return (
    <section className="lk-cal__results" aria-label="Calibration results">
      <table className="lk-cal__table">
        <thead>
          <tr>
            <th scope="col">Exercise</th>
            <th scope="col">Status</th>
            <th scope="col" className="lk-cal__num">
              Error px
            </th>
            <th scope="col" className="lk-cal__num">
              Max px
            </th>
          </tr>
        </thead>
        <tbody>
          {EXERCISES.map((ex, i) => (
            <Row key={ex.id} instruction={ex.instruction} score={scores[i] as ExerciseScore} />
          ))}
        </tbody>
      </table>
      <div className="lk-cal__actions">
        <Button onClick={copy}>Copy report</Button>
        <span className="lk-cal__summary">
          {passed} of {EXERCISES.length} pass
          {copied === 'copied' ? ' · copied' : copied === 'failed' ? ' · copy failed' : ''}
        </span>
      </div>
    </section>
  );
}
