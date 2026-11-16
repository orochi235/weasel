import { FOLLOW_APP, FOLLOW_LAB, type GlobalDeclarations } from './globals';

/** Throws on a shell config's `globals` or `loupe` naming something that is not there. */
export function checkShellConfig(globals: GlobalDeclarations | undefined, modeGlobal: string | undefined): void {
  const declared = globals ?? {};
  for (const [key, declaration] of Object.entries(declared)) {
    const at = `forge: defineShellConfig globals.${key}`;
    const values = declaration.options.map((option) => option.value);
    if (values.includes(FOLLOW_LAB)) {
      throw new Error(`${at} offers the value '${FOLLOW_LAB}', which a trial's pin uses to mean "follow the lab". Name the option something else.`);
    }
    const followsApp = declaration.follows !== undefined && declaration.default === FOLLOW_APP;
    if (!values.includes(declaration.default) && !followsApp) {
      const offered = values.map((value) => JSON.stringify(value)).join(', ');
      throw new Error(`${at}.default is ${JSON.stringify(declaration.default)}, which none of its options offers (${offered}).`);
    }
    const { under } = declaration;
    if (under === undefined) continue;
    const parent = Object.hasOwn(declared, under) ? declared[under] : undefined;
    if (!parent) throw new Error(`${at}.under names ${JSON.stringify(under)}, which is not a declared global.`);
    if (parent.under !== undefined) {
      throw new Error(
        `${at}.under names ${JSON.stringify(under)}, which is itself under ${JSON.stringify(parent.under)}; the toolbar nests one level only, so name a top-level global.`,
      );
    }
  }
  if (modeGlobal !== undefined && !Object.hasOwn(declared, modeGlobal)) {
    throw new Error(`forge: defineShellConfig loupe.modeGlobal names ${JSON.stringify(modeGlobal)}, which is not a declared global.`);
  }
}
