import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { packageRoute, symbolRoute } from '../../../shared/packageRoutes';
import type { PackageReference, ReferenceModule } from '../../../shared/reference';
import { Prose } from '../../Prose';
import s from './Reference.module.css';

/** One entry of a package: what it is imported by, and its exports under their headings. */
export function ModuleIndex({ reference, module }: { reference: PackageReference; module: ReferenceModule }) {
  const byName = new Map(module.symbols.map((symbol) => [symbol.name, symbol] as const).reverse());
  return (
    <div className={s.module}>
      {reference.modules.length > 1 && (
        <ul className={s.entries} aria-label="Entries">
          {reference.modules.map((other) => (
            <li key={other.name}>
              <a
                href={`#${packageRoute(reference.package, 'reference', other.name)}`}
                aria-current={other === module ? 'page' : undefined}
                className={other === module ? s.current : undefined}
              ><code>{other.specifier}</code></a>
            </li>
          ))}
        </ul>
      )}
      <h3 className={s.moduleName}>{module.specifier}</h3>
      <Prose blocks={module.doc} />
      {module.groups.length === 0 && <p className={s.note}>This entry exports nothing the reference documents.</p>}
      {module.groups.map((group) => (
        <section key={group.title} className={s.group}>
          <h4 className={s.groupTitle}>{group.title}</h4>
          <ul className={s.exports}>
            {group.names.map((name) => {
              const symbol = byName.get(name);
              return (
                <li key={name}>
                  <a
                    className={symbol?.deprecated ? `${s.exportName} ${s.struck}` : s.exportName}
                    href={`#${symbolRoute(reference.package, module.name, name)}`}
                  >{name}</a>
                  <span className={s.exportAbout}>
                    {symbol?.summary ? <InlineMarkdown text={symbol.summary} links="text" /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
