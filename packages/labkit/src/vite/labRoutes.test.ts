import { describe, expect, it } from 'vitest';
import { type PageRequest, type PageSite, pageUrlFor } from './labRoutes';

const site = (files: string[], base = '/'): PageSite => ({
  base,
  dir: '/lab',
  isFile: (path) => files.includes(path),
});
const doc = (url: string, headers: PageRequest['headers'] = { 'sec-fetch-dest': 'document' }) => ({
  method: 'GET',
  url,
  headers,
});

describe('pageUrlFor', () => {
  const pages = site(['/lab/fastmoney.html', '/lab/sub/plate.html']);

  it('sends a document request for an extensionless page to its .html', () => {
    expect(pageUrlFor(doc('/fastmoney'), pages)).toBe('/fastmoney.html');
    expect(pageUrlFor(doc('/sub/plate'), pages)).toBe('/sub/plate.html');
  });

  it('takes an Accept header that wants HTML as a document request', () => {
    const accept = { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
    expect(pageUrlFor(doc('/fastmoney', accept), pages)).toBe('/fastmoney.html');
  });

  it('leaves a module request alone', () => {
    expect(
      pageUrlFor(doc('/fastmoney', { 'sec-fetch-dest': 'script', accept: '*/*' }), pages),
    ).toBeUndefined();
    expect(pageUrlFor(doc('/fastmoney', {}), pages)).toBeUndefined();
    expect(pageUrlFor({ ...doc('/fastmoney'), method: 'POST' }, pages)).toBeUndefined();
  });

  it('leaves a path alone when no .html exists for it', () => {
    expect(pageUrlFor(doc('/missing'), pages)).toBeUndefined();
    expect(pageUrlFor(doc('/sub/'), pages)).toBeUndefined();
    expect(pageUrlFor(doc('/'), pages)).toBeUndefined();
  });

  it('keeps the query string', () => {
    expect(pageUrlFor(doc('/fastmoney?present&seed=2'), pages)).toBe(
      '/fastmoney.html?present&seed=2',
    );
  });

  it('leaves a path that already has an extension alone', () => {
    expect(pageUrlFor(doc('/fastmoney.html'), pages)).toBeUndefined();
    expect(pageUrlFor(doc('/fastmoney.tsx'), site(['/lab/fastmoney.tsx.html']))).toBeUndefined();
  });

  it('reads paths under the base and nothing outside it', () => {
    const based = site(['/lab/fastmoney.html'], '/gg/');
    expect(pageUrlFor(doc('/gg/fastmoney?x=1'), based)).toBe('/gg/fastmoney.html?x=1');
    expect(pageUrlFor(doc('/fastmoney'), based)).toBeUndefined();
  });

  it('never looks outside its directory', () => {
    const outside = site(['/etc.html', '/lab/fastmoney.html']);
    expect(pageUrlFor(doc('/%2E%2E/etc'), outside)).toBeUndefined();
    expect(pageUrlFor(doc('/%E0%A4%A'), outside)).toBeUndefined();
  });
});
