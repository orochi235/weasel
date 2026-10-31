/** Dragging a journey's scores, and editing its text in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { compileJourney } from './compile';
import { journeyScoreAt, setJourneyScore, setJourneySectionName, setJourneyTaskName } from './edit';
import type { JourneyData } from './types';

const stepOf = (data: JourneyData, datum: unknown): { section: number; task: number } | null => {
  const d = datum as { section?: unknown; task?: unknown } | undefined;
  if (typeof d?.section !== 'number' || typeof d.task !== 'number') return null;
  return data.sections[d.section]?.tasks[d.task] !== undefined ? { section: d.section, task: d.task } : null;
};

/** A step's dot takes a press, and a drag sets its score to the whole number under the pointer; the title, section
 *  names and step names take a text edit. */
export const journeyEditor: PlotEditor<JourneyData> = {
  handle(data, { trait, pose }) {
    if (trait.kind !== 'point' || trait.datum?.actor !== undefined || stepOf(data, trait.datum) === null) return null;
    return { at: { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 }, cursor: 'ns-resize' };
  },
  drag(data, trait, size, theme, measure) {
    const step = stepOf(data, trait.datum);
    if (step === null || trait.datum?.actor !== undefined) return null;
    const { layout } = compileJourney(data, size, theme, measure);
    return (at) => setJourneyScore(data, step.section, step.task, journeyScoreAt(layout, at));
  },
  text(data, datum, text) {
    const t = text.trim();
    if (datum.edit === 'title') return withTitle(data, text);
    if (datum.edit === 'section' && typeof datum.section === 'number' && data.sections[datum.section] !== undefined && t !== '') {
      return setJourneySectionName(data, datum.section, t);
    }
    const step = datum.edit === 'task' ? stepOf(data, datum) : null;
    return step === null || t === '' ? data : setJourneyTaskName(data, step.section, step.task, t);
  },
};
