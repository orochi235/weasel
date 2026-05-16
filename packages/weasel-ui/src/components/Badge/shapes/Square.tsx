import type { ShapeModule } from '../types';

const Square: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" rx="8" ry="8" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="1" y="1" width="98" height="98" rx="7" ry="7" />
      )}
      {focused && (
        <rect className="badge-focus" x="-3" y="-3" width="106" height="106" rx="11" ry="11" />
      )}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export default Square;
