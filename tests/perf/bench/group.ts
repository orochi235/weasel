/**
 * A titled set of benchmarks that run and report together as one table.
 *
 * vitest 5 hands `bench` to a test as a fixture rather than exporting it, and a
 * registration measures nothing until it is run. `group` is the `describe` the
 * bench files are written against: `body` registers benchmarks through the
 * `bench` it is given, and they run together once it returns. `options` are tinybench's run options (`time`, `iterations`,
 * `warmupTime`, …) for every benchmark in the group.
 */
import {
  test, type BenchFn, type BenchFnOptions, type BenchRegistration, type BenchRunOptions,
} from 'vitest';

type Register = (
  name: string, ...rest: [fn: BenchFn] | [options: BenchFnOptions, fn: BenchFn]
) => BenchRegistration<string>;

export function group(title: string, body: (bench: Register) => void, options?: BenchRunOptions): void {
  test(title, async ({ bench }) => {
    const registered: BenchRegistration<string>[] = [];
    const collect: Register = (name, ...rest) => {
      const r = rest.length === 1 ? bench(name, rest[0]) : bench(name, rest[0], rest[1]);
      registered.push(r);
      return r;
    };
    body(collect);
    if (registered.length === 1) await registered[0].run(options);
    else await (options ? bench.compare(...registered, options) : bench.compare(...registered));
  });
}
