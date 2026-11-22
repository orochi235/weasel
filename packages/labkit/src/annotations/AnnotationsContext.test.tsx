import { render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { expect, it } from 'vitest';
import { AnnotationsContext, useAnnotations } from './AnnotationsContext';
import { createMarkStore } from './store';

function Count({ children }: { children?: ReactNode }) {
  const marks = useAnnotations();
  return (
    <>
      <output>{marks.query().length}</output>
      {children}
    </>
  );
}

function AddOnMount() {
  const marks = useAnnotations();
  useEffect(() => {
    marks.add({ target: 't', kind: 'rect', frac: { x: 0, y: 0, width: 0.5, height: 0.5 } });
  }, [marks]);
  return null;
}

it('shows a mark added before the reader subscribed', () => {
  const store = createMarkStore({
    targets: () => [{ id: 't', content: { width: 10, height: 10 } }],
  });
  // A child's effect runs before its parent's, so the add lands before `Count` subscribes.
  render(
    <AnnotationsContext.Provider value={store}>
      <Count>
        <AddOnMount />
      </Count>
    </AnnotationsContext.Provider>,
  );
  expect(screen.getByRole('status').textContent).toBe('1');
});
