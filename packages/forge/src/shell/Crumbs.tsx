import './Crumbs.css';
import type { Instrument } from '@weasel-js/labkit';
import { Fragment } from 'react';
import type { IndexEntry } from '../story/types';
import { breadcrumb, crumbs } from './breadcrumb';
import { revealInTree } from './treeReveal';

function Crumbs({ entry }: { entry: IndexEntry }) {
  const steps = crumbs(entry.title, entry.name);
  return (
    <span className="fg-crumbs">
      {steps.map((step, i) => (
        <Fragment key={step.path ?? `${step.label}:${i}`}>
          {i > 0 ? (
            <span className="fg-crumbs__sep" aria-hidden="true">
              ›
            </span>
          ) : null}
          {step.path === null ? (
            <span className="fg-crumbs__here">{step.label}</span>
          ) : (
            <button
              type="button"
              className="fg-crumbs__step"
              title={`Show ${step.label} in the story tree`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => revealInTree(step.path as string)}
            >
              {step.label}
            </button>
          )}
        </Fragment>
      ))}
    </span>
  );
}

/** An entry's trial title: its breadcrumb, drawn with each folder a link to that folder in the story tree. A trial
 *  someone renamed shows the name it was given. */
export function crumbTitle(entry: IndexEntry): Pick<Instrument, 'title' | 'renderTitle'> {
  const title = breadcrumb(entry.title, entry.name);
  return { title, renderTitle: (shown) => (shown === title ? <Crumbs entry={entry} /> : shown) };
}
