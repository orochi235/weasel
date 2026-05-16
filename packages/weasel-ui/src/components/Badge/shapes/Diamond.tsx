import type { ShapeModule } from '../types';

const d = 'M 50 2 L 98 50 L 50 98 L 2 50 Z';

const Diamond: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M 50 -4 L 104 50 L 50 104 L -4 50 Z" />}
    </>
  ),
  insets: { top: 4, right: 12, bottom: 4, left: 12 },
  stretches: false,
  defaultAspect: 1,
};

export default Diamond;
