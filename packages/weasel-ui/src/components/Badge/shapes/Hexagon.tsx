import type { ShapeModule } from '../types';

const d = 'M 50 2 L 96 27 L 96 73 L 50 98 L 4 73 L 4 27 Z';

const Hexagon: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d="M 50 -3 L 101 24 L 101 76 L 50 103 L -1 76 L -1 24 Z" />
      )}
    </>
  ),
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: false,
  defaultAspect: 1.15,
};

export default Hexagon;
