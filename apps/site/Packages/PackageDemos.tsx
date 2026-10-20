import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import type { PackageEntry } from '../../shared/packageDocs';
import { placeOf, type DemoEntry } from '../registry';
import s from './Packages.module.css';

/** The demos whose source imports a package, each a link to the demo. */
export function PackageDemos({ pkg, demos }: { pkg: PackageEntry; demos: DemoEntry[] }) {
  if (demos.length === 0) return <p className={s.note}>No demo imports {pkg.specifier}.</p>;
  return (
    <ul className={s.demos}>
      {demos.map((demo) => (
        <li key={demo.id}>
          <a className={s.demoTitle} href={`#${demo.id}`}>{demo.title}</a>
          <span className={s.demoPlace}>{placeOf(demo)}</span>
          <p className={s.demoAbout}><InlineMarkdown text={demo.description} links="text" /></p>
        </li>
      ))}
    </ul>
  );
}
