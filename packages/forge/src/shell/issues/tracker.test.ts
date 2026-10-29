import { f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { parseRoute } from '../../route/url';
import { newIssueUrl, reopenLink, reportBody } from './tracker';

const repo = { slug: 'acme/widgets', url: 'https://github.com/acme/widgets' };
const report = { component: 'Slider', storyId: 'slider--basic', title: 'Thumb drifts', body: 'Drag past the end.\n' };
const context = { link: 'http://localhost:5173/#/slider--basic?max=10', branch: 'slider-fix', commit: 'abc1234def' };

describe('reopenLink', () => {
  it('names the story with the knobs that differ from their defaults and every global pinned', () => {
    const schema = f.schema({ max: f.number(100), label: f.string('Volume') });
    const link = reopenLink('http://localhost:5173/', 'slider--basic', schema, { max: 10, label: 'Volume' }, { mode: 'dark' });
    const { story, params } = parseRoute(new URL(link).hash);
    expect(link.startsWith('http://localhost:5173/#/slider--basic?')).toBe(true);
    expect(story).toBe('slider--basic');
    expect(params).toEqual({ max: '10', '$globals.mode': 'dark' });
  });
});

describe('newIssueUrl', () => {
  it('opens the repo’s new-issue page with the title, the component’s label and the report’s body', () => {
    const url = new URL(newIssueUrl(repo, report, context));
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/acme/widgets/issues/new');
    expect(url.searchParams.get('title')).toBe('Thumb drifts');
    expect(url.searchParams.get('labels')).toBe('forge:Slider');
    expect(url.searchParams.get('body')).toBe(reportBody(report, context));
  });

  it('puts the story, the link reopening it, and the branch and commit under what the reporter wrote', () => {
    const body = reportBody(report, context);
    expect(body.startsWith('Drag past the end.\n\n---\n\n')).toBe(true);
    expect(body).toContain('**Story:** `slider--basic`');
    expect(body).toContain(`**Reopen:** ${context.link}`);
    expect(body).toContain('**Branch:** `slider-fix`');
    expect(body).toContain('**Commit:** abc1234def');
  });

  it('leaves out a branch it does not have, and the reporter’s text when there is none', () => {
    const body = reportBody({ ...report, body: '  ' }, { ...context, branch: null });
    expect(body.startsWith('---')).toBe(true);
    expect(body).not.toContain('Branch');
    expect(body).toContain('**Commit:** abc1234def');
  });
});
