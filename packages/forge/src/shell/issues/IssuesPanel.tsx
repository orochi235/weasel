import './issues.css';
import { type LabContribution, useLabContext } from '@weasel-js/labkit';
import num from '@weasel-js/theme/numeric.module.css';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import { TextArea } from '@weasel-js/ui/components/TextArea';
import { type FormEvent, useState } from 'react';
import type { IndexEntry } from '../../story/types';

/** An open issue filed against a component. */
export interface ForgeIssue {
  number: number;
  title: string;
  url: string;
  /** When it was opened, as an ISO date. */
  opened: string;
}

/** What the Report form hands its host. */
export interface IssueReport {
  /** The component the report is about, as the panel names it. */
  component: string;
  /** The story the report was made from. */
  storyId: string;
  title: string;
  body: string;
}

export interface IssuesPanelProps {
  component: string;
  storyId: string;
  /** The component's open issues. Absent, the panel is not connected to a tracker and says so. */
  issues?: readonly ForgeIssue[];
  /** Absent, the Report button stays disabled. */
  onReport?: (report: IssueReport) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function IssueList({ component, issues }: { component: string; issues: readonly ForgeIssue[] | undefined }) {
  if (!issues) return <p className="fg-issues__note">Not connected to an issue tracker.</p>;
  if (issues.length === 0) return <p className="fg-issues__note">No open issues for {component}.</p>;
  return (
    <ul className="fg-issues__list">
      {issues.map((issue) => (
        <li key={issue.number} className="fg-issues__item">
          <a href={issue.url} target="_blank" rel="noreferrer" className="fg-issues__link">
            <span className={`fg-issues__number ${num.numeric}`}>#{issue.number}</span>
            <span className="fg-issues__title">{issue.title}</span>
          </a>
          <time className={`fg-issues__opened ${num.numeric}`} dateTime={issue.opened}>
            {dateFormat.format(new Date(issue.opened))}
          </time>
        </li>
      ))}
    </ul>
  );
}

/** A component's open issues, and a form for reporting a new one. */
export function IssuesPanel({ component, storyId, issues, onReport }: IssuesPanelProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const canReport = onReport !== undefined && title.trim() !== '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canReport) return;
    onReport({ component, storyId, title: title.trim(), body });
    setTitle('');
    setBody('');
  };
  return (
    <div className="fg-issues">
      <section className="fg-issues__group" aria-label="Open issues">
        <h3 className="fg-issues__heading">Open</h3>
        <IssueList component={component} issues={issues} />
      </section>
      <form className="fg-issues__group" aria-label="Report an issue" onSubmit={submit}>
        <h3 className="fg-issues__heading">Report</h3>
        <Input label="Title" value={title} onChange={setTitle} />
        <TextArea label="Description" value={body} onChange={setBody} placeholder="What did you expect, and what happened?" />
        <div className="fg-issues__actions">
          <Button size="sm" type="submit" disabled={!canReport}>
            Report
          </Button>
        </div>
        {onReport ? null : <p className="fg-issues__note">Reporting is not connected yet.</p>}
      </form>
    </div>
  );
}

/** The panel for the lab's focused trial, naming the component its story renders. */
function FocusedIssues({ index }: { index: readonly IndexEntry[] }) {
  const { focusedTrialId, trials } = useLabContext();
  const record = trials.find((trial) => trial.id === focusedTrialId);
  const entry = record && index.find((e) => e.id === record.instrumentName);
  if (!entry) return null;
  const component = entry.componentName ?? entry.title.split('/').at(-1) ?? entry.title;
  return (
    <section className="fg-issues-focus" aria-label="Issues">
      <p className="fg-issues__component">{component}</p>
      <IssuesPanel key={entry.id} component={component} storyId={entry.id} />
    </section>
  );
}

/** The lab aside section listing and reporting issues against the focused trial's component. */
export function issuesSection(index: readonly IndexEntry[]): LabContribution {
  return { id: 'fg-issues', region: 'aside', item: { title: 'Issues', body: <FocusedIssues index={index} /> } };
}
