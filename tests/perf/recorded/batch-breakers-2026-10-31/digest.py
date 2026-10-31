#!/usr/bin/env python3
"""Before/after digest of the result files under msb-uai/: each clip-cost variant's frame and draws,
each derived clip-cost figure, and each transition-matrix homogeneous kind per command."""
import glob, json, os, statistics
here = os.path.dirname(os.path.abspath(__file__))

def load(label, bench):
    f = glob.glob(os.path.join(here, 'msb-uai', label, f'{bench}-*.json'))[0]
    return {i['id']: i['metrics'] for i in json.load(open(f))['items']}

for bench in ['clip-cost', 'transition-matrix']:
    runs = {l: load(l, bench) for l in ['before-1', 'before-2', 'after-1', 'after-2']}
    print(f'\n## {bench}\n')
    print(f'| item | metric | {"before":>15} | {"after":>15} |')
    print('|---|---|---:|---:|')
    for item in runs['before-1']:
        for m, v in runs['before-1'][item].items():
            if m not in ('perFrame', 'perClip', 'perStroke', 'perFlush', 'drawCalls', 'perCommand', 'perNest', 'perBoundary'):
                continue
            cell = lambda side: '–'.join(f"{runs[f'{side}-{k}'][item][m]['value']:.3f}" for k in (1, 2)) if item in runs[f'{side}-1'] else ''
            print(f"| {item} | {m} | {cell('before'):>15} | {cell('after'):>15} |")
