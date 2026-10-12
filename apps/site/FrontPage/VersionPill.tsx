import { buildTitle, BUILD_VERSION } from '../../shared/buildInfo';
import s from './VersionPill.module.css';

/** The kit version this build was compiled against. The host's class places it. */
export function VersionPill({ className }: { className?: string }) {
  return (
    <span className={className ? `${s.pill} ${className}` : s.pill} title={buildTitle()}>
      v{BUILD_VERSION}
    </span>
  );
}
