import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { packageRoute } from '@shared/packageRoutes';
import { SiteNav } from '../SiteNav';

afterEach(cleanup);

const heading = (pkg: string) => screen.getByRole('heading', { level: 3, name: pkg }).querySelector('a')!;

describe('the sidebar', () => {
  it("marks a package's heading active on each of that package's pages, and on no other", () => {
    for (const id of [packageRoute('geom'), packageRoute('geom', 'reference', 'Rect')]) {
      render(<SiteNav activeId={id} onPick={() => {}} />);
      expect(heading('geom'), id).toHaveClass('active');
      expect(heading('core'), id).not.toHaveClass('active');
      cleanup();
    }
    render(<SiteNav activeId="pkg" onPick={() => {}} />);
    expect(heading('geom')).not.toHaveClass('active');
  });
});
