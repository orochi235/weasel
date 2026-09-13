import { f } from './builder';

export const flat = f.schema({ n: f.number(1).range(0, 4), s: f.string('x').label('S') });

export const grouped = f.schema({
  g: f.group({ on: f.boolean(true).toggle(), e: f.enum('a', ['a', 'b']).radio() }).label('G'),
});

export const node = f.number(1).slider();

export const group = f.group({ c: f.color('#fff'), v: f.value(1), k: f.custom('k', 'x') });
