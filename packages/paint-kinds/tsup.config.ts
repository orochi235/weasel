import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// The registry's dynamic-import targets, rebuilt in dist/ as one self-contained file each. esbuild with code
// splitting makes an entry import every module a dynamic import's chunk shares with the barrel's graph, used or not,
// so a lazy kind sharing a chunk with the renderer would load with any import of core. The copy duplicates only
// stateless code, and must stay that way: a second copy of a registry would register into nothing.
const LAZY_KINDS = ['meshKindLazy'];
// Of the renderer's dist only `mesh.js` may be bundled: a shared chunk beside it would be one the renderer's index
// also loads, registries included.
const REGISTRY_STATE =
  /packages\/registry\/|paint-kinds\/src\/paintKinds\.|packages\/renderer\/(src\/(paintKinds|shaders\/registerProgram)\.|dist\/(?!mesh\.))/;

async function selfContainedLazyKinds(): Promise<void> {
  for (const name of LAZY_KINDS) {
    const bundle = await rolldown({ input: fileURLToPath(new URL(`src/${name}.ts`, import.meta.url)), logLevel: 'silent' });
    const { output } = await bundle.write({
      file: fileURLToPath(new URL(`dist/${name}.js`, import.meta.url)),
      format: 'es',
      sourcemap: true,
      codeSplitting: false,
    });
    await bundle.close();
    const chunk = output[0];
    const stateful = chunk.moduleIds.filter((id) => REGISTRY_STATE.test(id));
    if (stateful.length || chunk.imports.length || chunk.dynamicImports.length) {
      throw new Error(
        `${name}.js must be self-contained and hold no registry state; it bundles ` +
          `${stateful.join(', ') || '(none)'} and imports ` +
          `${[...chunk.imports, ...chunk.dynamicImports].join(', ') || '(nothing)'}.`,
      );
    }
  }
}

export default defineConfig({
  ...packagePreset({
    entry: {
      index: 'src/index.ts',
      react: 'src/react.ts',
      mesh: 'src/mesh.ts',
      meshKindLazy: 'src/meshKindLazy.ts',
      'icons.table': 'src/icons.table.ts',
      'test-seams': 'src/test-seams.ts',
    },
  }),
  onSuccess: selfContainedLazyKinds,
});
