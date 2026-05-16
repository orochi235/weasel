import type { ShapeModule } from '../types';

const Dot: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <circle className="badge-fill" cx="50" cy="50" r="50" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <circle className="badge-stroke" cx="50" cy="50" r="49" />
      )}
      {focused && <circle className="badge-focus" cx="50" cy="50" r="54" />}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: false,
  defaultAspect: 1,
};

export default Dot;
