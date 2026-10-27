import { describe, expect, it } from 'vitest';

import { rssXml } from './rss';

const CHANNEL = {
  title: 'RDM Labs · Cosmos',
  description: 'Artigos, estudos, projetos e registros de rotina.',
};

const ENTRIES = [
  {
    slug: 'code-review-sem-atrito',
    title: 'Code review sem atrito',
    summary: 'Comentar o código, não a pessoa.',
    publishedAt: '2025-09-12T12:00:00.000Z',
  },
  {
    slug: 'shaders-glsl-para-interfaces',
    title: 'Shaders GLSL para interfaces',
    summary: 'Ruído, fresnel e deformação de malha.',
    publishedAt: '2026-05-30T12:00:00.000Z',
  },
];

describe('rssXml', () => {
  const xml = rssXml('https://rdmlabs.dev', 'pt', CHANNEL, ENTRIES);

  it('declara RSS 2.0', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0">');
  });

  it('o canal traz título, link da raiz do idioma e descrição', () => {
    expect(xml).toContain('<title>RDM Labs · Cosmos</title>');
    expect(xml).toContain('<link>https://rdmlabs.dev/pt</link>');
    expect(xml).toContain('<description>Artigos, estudos, projetos e registros de rotina.</description>');
  });

  it('o canal declara o idioma, com o mesmo código do lang da página', () => {
    expect(xml).toContain('<language>pt-BR</language>');
    expect(rssXml('https://rdmlabs.dev', 'en', CHANNEL, [])).toContain('<language>en-GB</language>');
  });

  it('um item por publicação, com link absoluto do idioma pedido', () => {
    expect(xml.match(/<item>/g)?.length).toBe(2);
    expect(xml).toContain('<link>https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito</link>');
    expect(xml).toContain(
      '<guid isPermaLink="true">https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito</guid>',
    );
  });

  it('o resumo vai como description do item', () => {
    expect(xml).toContain('<description>Comentar o código, não a pessoa.</description>');
  });

  it('pubDate em RFC 822, em UTC', () => {
    expect(xml).toContain('<pubDate>Fri, 12 Sep 2025 12:00:00 GMT</pubDate>');
  });

  it('escapa & < > " \' nos campos de texto', () => {
    const perigoso = rssXml('https://rdmlabs.dev', 'pt', CHANNEL, [
      {
        slug: 'x',
        title: `<script>alert('x')</script> & "aspas"`,
        summary: 'A & B < C > D',
        publishedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);

    expect(perigoso).not.toContain('<script>');
    expect(perigoso).toContain(
      '&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt; &amp; &quot;aspas&quot;',
    );
    expect(perigoso).toContain('A &amp; B &lt; C &gt; D');
  });

  it('idiomas diferentes geram links e raiz diferentes', () => {
    const en = rssXml('https://rdmlabs.dev', 'en', CHANNEL, ENTRIES);
    expect(en).toContain('<link>https://rdmlabs.dev/en</link>');
    expect(en).toContain(
      '<link>https://rdmlabs.dev/en/publications/code-review-sem-atrito</link>',
    );
  });

  it('não duplica a barra quando a origem traz uma', () => {
    expect(rssXml('https://rdmlabs.dev/', 'pt', CHANNEL, ENTRIES)).not.toContain('rdmlabs.dev//');
  });

  it('acervo vazio ainda produz um canal válido, sem item', () => {
    const vazio = rssXml('https://rdmlabs.dev', 'pt', CHANNEL, []);
    expect(vazio).not.toContain('<item>');
    expect(vazio).toContain('<channel>');
  });
});
