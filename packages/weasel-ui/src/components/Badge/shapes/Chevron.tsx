import type { ShapeModule } from '../types';

const d = 'M 0 0 L 88 0 L 100 50 L 88 100 L 0 100 Z';

const Chevron: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M -3 -3 L 89 -3 L 104 50 L 89 103 L -3 103 Z" />}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 0 },
  stretches: true,
};

export default Chevron;
