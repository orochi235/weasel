import { type LabContribution, useLabContext } from '@weasel-js/labkit';
import type { IndexEntry } from '../../story/types';
import { IssuesPanel } from './IssuesPanel';
import { TrackedIssues } from './TrackedIssues';

/** The panel for the lab's focused trial, naming the component its story renders. */
function FocusedIssues({ index, base }: { index: readonly IndexEntry[]; base: string | undefined }) {
  const { focusedTrialId, trials } = useLabContext();
  const record = trials.find((trial) => trial.id === focusedTrialId);
  const entry = record && index.find((e) => e.id === record.instrumentName);
  if (!entry) return null;
  const component = entry.componentName ?? entry.title.split('/').at(-1) ?? entry.title;
  return (
    <section className="fg-issues-focus" aria-label="Issues">
      <p className="fg-issues__component">{component}</p>
      {base === undefined ? (
        <IssuesPanel key={entry.id} component={component} storyId={entry.id} />
      ) : (
        <TrackedIssues key={entry.id} base={base} storyId={entry.id} component={component} />
      )}
    </section>
  );
}

/**
 * The lab aside section listing and reporting issues against the focused trial's component, through the dev server
 * at `base`. With no `base`, as in a built workshop, it says it is not connected.
 */
export function issuesSection(index: readonly IndexEntry[], base?: string): LabContribution {
  return { id: 'fg-issues', region: 'aside', item: { title: 'Issues', body: <FocusedIssues index={index} base={base} /> } };
}
