#!/usr/bin/env python3
"""Before/after digest of msb-uai/: each tessellateStroke bench row's mean, and the clip-cost astroke frames."""
import glob, json, os, re
here = os.path.dirname(os.path.abspath(__file__))
ansi = re.compile(r'\x1b\[[0-9;]*m')
LABELS = ['before-1', 'before-2', 'after-1', 'after-2']

def bench_means(label):
    out, group = {}, None
    for line in open(os.path.join(here, 'msb-uai', f'{label}.bench.log')):
        line = ansi.sub('', line)
        if '✓' in line:
            group = line.split('✓')[1].strip().rsplit(' ', 1)[0]
        m = re.match(r'\s+(\S.*?)\s{2,}([\d,.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', line)
        if group and group.startswith('tessellateStroke') and m:
            out[f'{group} / {m.group(1)}'] = float(m.group(5)) * 1000
    return out

def frames(label):
    f = glob.glob(os.path.join(here, 'msb-uai', label, 'clip-cost-*.json'))[0]
    it = {i['id']: i['metrics'] for i in json.load(open(f))['items']}
    return {k: it[k]['perFrame']['value'] for k in ('astroke-center', 'astroke-inner')}

b = {l: bench_means(l) for l in LABELS}
c = {l: frames(l) for l in LABELS}
print(f'| row | {"before, us":>15} | {"after, us":>15} |\n|---|---:|---:|')
for row in b['before-1']:
    cell = lambda s: ' – '.join(f"{b[f'{s}-{k}'][row]:6.1f}" for k in (1, 2))
    print(f'| {row} | {cell("before"):>15} | {cell("after"):>15} |')
for row in c['before-1']:
    cell = lambda s: ' – '.join(f"{c[f'{s}-{k}'][row]:6.3f}" for k in (1, 2))
    print(f'| {row}, ms a frame | {cell("before"):>15} | {cell("after"):>15} |')
