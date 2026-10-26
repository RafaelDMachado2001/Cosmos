import { describe, expect, it } from 'vitest';

import { assetRefs, missingAssets } from './assets';

const TEMPLATE = `<!doctype html>
<head>
  <script type="module" crossorigin src="/assets/index-D01KjhG2.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/three-Cc7LBMMo.js">
  <link rel="stylesheet" crossorigin href="/assets/style-9cYTb_PA.css">
  <link rel="icon" href="/favicon.svg">
</head>`;

describe('assetRefs', () => {
  it('lista os arquivos com hash que o molde carrega, sem a barra inicial', () => {
    expect(assetRefs(TEMPLATE)).toEqual([
      'assets/index-D01KjhG2.js',
      'assets/three-Cc7LBMMo.js',
      'assets/style-9cYTb_PA.css',
    ]);
  });
});

describe('missingAssets', () => {
  it('aponta o que o molde pede e o destino não tem', () => {
    const existing = new Set(['assets/index-py1KIQ22.js', 'assets/style-9cYTb_PA.css']);
    expect(missingAssets(TEMPLATE, (path) => existing.has(path))).toEqual([
      'assets/index-D01KjhG2.js',
      'assets/three-Cc7LBMMo.js',
    ]);
  });

  it('nada falta quando o molde e o destino vem do mesmo build', () => {
    expect(missingAssets(TEMPLATE, () => true)).toEqual([]);
  });
});
