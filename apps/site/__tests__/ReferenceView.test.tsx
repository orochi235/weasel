import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PROJECT } from '../../../scripts/lib/reference/fixture';
import { readProject } from '../../../scripts/lib/reference/project';
import { ReferenceView } from '../Packages/reference/ReferenceView';

// The model the pages draw, read from the same hand-written TypeDoc project the reader's own test uses.
const [geom, core] = readProject(PROJECT);

afterEach(cleanup);

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

describe('a module\'s index', () => {
  it('lists the package\'s entries and the root entry\'s exports under their headings', () => {
    render(<ReferenceView reference={geom} rest="" />);
    expect(screen.getByRole('heading', { level: 3, name: '@weasel-js/geom' })).toBeTruthy();
    expect(hrefOf('@weasel-js/geom/booleans')).toBe('#pkg/geom/reference/booleans');
    const functions = screen.getByRole('heading', { level: 4, name: 'Functions' }).closest('section')!;
    const row = within(functions).getByRole('listitem');
    expect(within(row).getByRole('link', { name: 'clamp' }).getAttribute('href')).toBe('#pkg/geom/reference/clamp');
    expect(row.textContent).toContain('Holds a value inside a range.');
  });

  it('opens a subpath entry by its name, with what its module comment says', () => {
    render(<ReferenceView reference={geom} rest="booleans" />);
    expect(screen.getByRole('heading', { level: 3, name: '@weasel-js/geom/booleans' })).toBeTruthy();
    expect(screen.getByText('Set operations on boxes.')).toBeTruthy();
    expect(hrefOf('unionBoxes')).toBe('#pkg/geom/reference/booleans/unionBoxes');
  });
});

describe('an export\'s page', () => {
  it('draws a function\'s overloads, linking the types that have pages', () => {
    const { container } = render(<ReferenceView reference={geom} rest="clamp" />);
    expect(screen.getByRole('heading', { level: 3, name: 'clamp' })).toBeTruthy();
    const declarations = [...container.querySelectorAll('pre')].map((pre) => pre.textContent);
    expect(declarations).toContain('function clamp<T extends number = number>(value: T, lo?: number, ...rest: number[]): T');
    expect(declarations).toContain('function clamp(options?: Point): void');
    expect(screen.getAllByRole('link', { name: 'Point' })[0].getAttribute('href')).toBe('#pkg/geom/reference/Point');
    expect(screen.getByText('What to hold.')).toBeTruthy();
    expect(screen.getByText('The nearest value in range.')).toBeTruthy();
    expect(screen.getByText('Deprecated')).toBeTruthy();
    expect(hrefOf('← @weasel-js/geom')).toBe('#pkg/geom/reference');
  });

  it('draws an interface\'s members, each with its own comment', () => {
    render(<ReferenceView reference={geom} rest="Box" />);
    expect(screen.getByText('interface Box')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Members' })).toBeTruthy();
    expect(screen.getByText('Whether a point lies inside.')).toBeTruthy();
  });

  it('draws a class\'s members in sections, and says where an inherited one comes from', () => {
    render(<ReferenceView reference={geom} rest="Grid" />);
    for (const title of ['Constructor', 'Properties', 'Accessors', 'Methods']) {
      expect(screen.getByRole('heading', { level: 4, name: title })).toBeTruthy();
    }
    expect(screen.getByText('new Grid(size: number)')).toBeTruthy();
    expect(hrefOf('Box.x')).toBe('#pkg/geom/reference/Box');
  });

  it('opens a subpath export, and points a re-export at the package that declares it', () => {
    render(<ReferenceView reference={geom} rest="booleans/unionBoxes" />);
    expect(screen.getByRole('heading', { level: 3, name: 'unionBoxes' })).toBeTruthy();
    cleanup();
    render(<ReferenceView reference={core} rest="Box" />);
    expect(hrefOf('See where it is declared.')).toBe('#pkg/geom/reference/Box');
  });

  it('says so when the address names nothing the entry exports', () => {
    render(<ReferenceView reference={geom} rest="noSuchExport" />);
    expect(screen.getByText(/exports nothing named/)).toBeTruthy();
  });
});
