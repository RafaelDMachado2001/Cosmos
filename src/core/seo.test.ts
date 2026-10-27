import { describe, expect, it } from 'vitest';

import { ogImagePath } from './og';
import {
  articleJsonLd,
  homeJsonLd,
  articleMeta,
  articleOgCard,
  homeMeta,
  homeOgCard,
  notFoundHeadTags,
  renderHeadTags,
} from './seo';
import type { JsonLd, MetaSite } from './seo';

const SITE: MetaSite = {
  origin: 'https://rdmlabs.dev',
  siteName: 'RDM Labs',
  authorName: 'Rafael Dorneles Machado',
};

const ARTICLE = {
  slug: 'code-review-sem-atrito',
  title: 'Code review sem atrito',
  summary: 'Revisar sem travar o time.',
  publishedAt: '2025-09-09T00:00:00.000Z',
  categoryLabel: 'Artigo técnico',
  category: 'artigo' as const,
};

describe('articleMeta', () => {
  it('põe o nome do site depois do título', () => {
    expect(articleMeta(SITE, 'pt', ARTICLE).title).toBe('Code review sem atrito · RDM Labs');
  });

  it('descreve com o resumo', () => {
    expect(articleMeta(SITE, 'pt', ARTICLE).description).toBe('Revisar sem travar o time.');
  });

  it('canoniza a URL do idioma pedido', () => {
    expect(articleMeta(SITE, 'pt', ARTICLE).canonical).toBe(
      'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito',
    );
    expect(articleMeta(SITE, 'en', ARTICLE).canonical).toBe(
      'https://rdmlabs.dev/en/publications/code-review-sem-atrito',
    );
  });

  it('não duplica a barra quando a origem traz uma', () => {
    const meta = articleMeta({ ...SITE, origin: 'https://rdmlabs.dev/' }, 'pt', ARTICLE);
    expect(meta.canonical).toBe('https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito');
  });

  it('aponta os dois idiomas e um x-default', () => {
    expect(articleMeta(SITE, 'en', ARTICLE).alternates).toEqual([
      { hreflang: 'pt', href: 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito' },
      { hreflang: 'en', href: 'https://rdmlabs.dev/en/publications/code-review-sem-atrito' },
      { hreflang: 'x-default', href: 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito' },
    ]);
  });

  it('sem tradução no outro idioma, não anuncia um par que não existe', () => {
    const meta = articleMeta(SITE, 'pt', ARTICLE, ['pt']);
    expect(meta.alternates).toEqual([
      { hreflang: 'pt', href: 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito' },
      { hreflang: 'x-default', href: 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito' },
    ]);
    expect(meta.og['og:locale:alternate']).toBe('');
  });

  it('só em inglês: x-default cai no inglês, não no português ausente', () => {
    const meta = articleMeta(SITE, 'en', ARTICLE, ['en']);
    expect(meta.alternates).toEqual([
      { hreflang: 'en', href: 'https://rdmlabs.dev/en/publications/code-review-sem-atrito' },
      { hreflang: 'x-default', href: 'https://rdmlabs.dev/en/publications/code-review-sem-atrito' },
    ]);
  });

  it('o alternate do próprio idioma é o canonical', () => {
    const meta = articleMeta(SITE, 'en', ARTICLE);
    const self = meta.alternates.find((item) => item.hreflang === 'en');
    expect(self?.href).toBe(meta.canonical);
  });

  it('abre o grafo como artigo, na URL canônica', () => {
    const { og } = articleMeta(SITE, 'pt', ARTICLE);
    expect(og['og:type']).toBe('article');
    expect(og['og:url']).toBe('https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito');
    expect(og['og:title']).toBe('Code review sem atrito');
    expect(og['og:description']).toBe('Revisar sem travar o time.');
    expect(og['og:site_name']).toBe('RDM Labs');
    expect(og['og:locale']).toBe('pt_BR');
    expect(og['og:locale:alternate']).toBe('en_GB');
  });

  it('seoTitle/seoDescription sobrepõem title/summary no título, na descrição e no Open Graph', () => {
    const override = { ...ARTICLE, seoTitle: 'Título de SEO', seoDescription: 'Descrição de SEO.' };
    const meta = articleMeta(SITE, 'pt', override);

    expect(meta.title).toBe('Título de SEO · RDM Labs');
    expect(meta.description).toBe('Descrição de SEO.');
    expect(meta.og['og:title']).toBe('Título de SEO');
    expect(meta.og['og:description']).toBe('Descrição de SEO.');
  });

  it('sem seoTitle/seoDescription, cai em title/summary — comportamento de sempre', () => {
    const meta = articleMeta(SITE, 'pt', ARTICLE);
    expect(meta.title).toBe('Code review sem atrito · RDM Labs');
    expect(meta.description).toBe('Revisar sem travar o time.');
  });

  it('article:modified_time só aparece quando houve edição depois de publicar', () => {
    expect(articleMeta(SITE, 'pt', ARTICLE).og).not.toHaveProperty('article:modified_time');
    const same = articleMeta(SITE, 'pt', { ...ARTICLE, updatedAt: ARTICLE.publishedAt });
    expect(same.og).not.toHaveProperty('article:modified_time');
    const edited = articleMeta(SITE, 'pt', { ...ARTICLE, updatedAt: '2025-10-01T10:00:00.000Z' });
    expect(edited.og['article:modified_time']).toBe('2025-10-01T10:00:00.000Z');
  });

  it('indexable: false declara noindex; ausente ou true não declara nada', () => {
    expect(articleMeta(SITE, 'pt', { ...ARTICLE, indexable: false }).robots).toBe('noindex');
    expect(articleMeta(SITE, 'pt', { ...ARTICLE, indexable: true }).robots).toBeUndefined();
    expect(articleMeta(SITE, 'pt', ARTICLE).robots).toBeUndefined();
  });
});

describe('cartão do X', () => {
  it('artigo e home declaram título, descrição e imagem também em twitter:*', () => {
    const article = articleMeta(SITE, 'pt', ARTICLE).og;
    expect(article['twitter:title']).toBe(article['og:title']);
    expect(article['twitter:description']).toBe(article['og:description']);
    expect(article['twitter:image']).toBe(article['og:image']);

    const home = homeMeta(SITE, 'en', { title: 'T', description: 'D' }).og;
    expect([home['twitter:title'], home['twitter:description']]).toEqual(['T', 'D']);
    expect(home['twitter:image']).toBe(home['og:image']);
  });

  it('og:locale segue o mesmo padrão nos dois idiomas, com o outro como alternate', () => {
    expect(homeMeta(SITE, 'pt', { title: 'T', description: 'D' }).og['og:locale']).toBe('pt_BR');
    expect(homeMeta(SITE, 'pt', { title: 'T', description: 'D' }).og['og:locale:alternate']).toBe('en_GB');
    expect(articleMeta(SITE, 'en', ARTICLE).og['og:locale']).toBe('en_GB');
    expect(articleMeta(SITE, 'en', ARTICLE).og['og:locale:alternate']).toBe('pt_BR');
  });
});

describe('homeMeta', () => {
  const COPY = { title: 'RDM Labs · Cosmos', description: 'Uma constelação temporal.' };

  it('usa o texto do dicionário como está', () => {
    const meta = homeMeta(SITE, 'pt', COPY);
    expect(meta.title).toBe('RDM Labs · Cosmos');
    expect(meta.description).toBe('Uma constelação temporal.');
  });

  it('canoniza a raiz do idioma', () => {
    expect(homeMeta(SITE, 'en', COPY).canonical).toBe('https://rdmlabs.dev/en');
  });

  it('é website, não artigo', () => {
    expect(homeMeta(SITE, 'pt', COPY).og['og:type']).toBe('website');
  });

  it('aponta os dois idiomas e um x-default', () => {
    expect(homeMeta(SITE, 'pt', COPY).alternates).toEqual([
      { hreflang: 'pt', href: 'https://rdmlabs.dev/pt' },
      { hreflang: 'en', href: 'https://rdmlabs.dev/en' },
      { hreflang: 'x-default', href: 'https://rdmlabs.dev/pt' },
    ]);
  });

  it('anuncia o feed RSS daquele idioma, para autodescoberta', () => {
    expect(homeMeta(SITE, 'pt', COPY).rssHref).toBe('https://rdmlabs.dev/pt/rss.xml');
    expect(homeMeta(SITE, 'en', COPY).rssHref).toBe('https://rdmlabs.dev/en/rss.xml');
  });
});

/** O nó do grafo com este `@type`. */
function node(graph: JsonLd, type: string): Record<string, unknown> {
  const found = graph['@graph'].find((entry) => entry['@type'] === type);
  if (!found) throw new Error(`sem ${type} no grafo`);
  return found;
}

const FULL_SITE: MetaSite = {
  ...SITE,
  authorUrl: 'https://portfolio.rdmlabs.dev',
  authorSameAs: ['https://github.com/fulano', 'https://www.linkedin.com/in/fulano'],
  logoPath: '/apple-touch-icon.png',
};

describe('articleJsonLd', () => {
  const graph = articleJsonLd(FULL_SITE, 'pt', { ...ARTICLE, wordCount: 812 });
  const json = node(graph, 'BlogPosting');

  it('é um grafo do schema.org com o BlogPosting e o breadcrumb', () => {
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph'].map((entry) => entry['@type'])).toEqual(['BlogPosting', 'BreadcrumbList']);
  });

  it('leva título, resumo e seção', () => {
    expect(json.headline).toBe('Code review sem atrito');
    expect(json.description).toBe('Revisar sem travar o time.');
    expect(json.articleSection).toBe('Artigo técnico');
  });

  it('data em ISO e idioma da versão', () => {
    expect(json.datePublished).toBe('2025-09-09T00:00:00.000Z');
    expect(json.inLanguage).toBe('pt-BR');
    expect(node(articleJsonLd(SITE, 'en', ARTICLE), 'BlogPosting').inLanguage).toBe('en-GB');
  });

  it('a entidade principal é a página canônica', () => {
    expect(json.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito',
    });
  });

  it('credita o autor com a página dele e os outros perfis', () => {
    expect(json.author).toEqual({
      '@type': 'Person',
      name: 'Rafael Dorneles Machado',
      url: 'https://portfolio.rdmlabs.dev',
      sameAs: ['https://github.com/fulano', 'https://www.linkedin.com/in/fulano'],
    });
    // Sem os dados, só o nome — nada de chave vazia no grafo.
    expect(node(articleJsonLd(SITE, 'pt', ARTICLE), 'BlogPosting').author).toEqual({
      '@type': 'Person',
      name: 'Rafael Dorneles Machado',
    });
  });

  it('conta as palavras quando sabe, e não inventa quando não sabe', () => {
    expect(json.wordCount).toBe(812);
    expect(node(articleJsonLd(SITE, 'pt', ARTICLE), 'BlogPosting')).not.toHaveProperty('wordCount');
  });

  it('leva a imagem do cartão, a mesma do og:image', () => {
    const og = articleMeta(SITE, 'pt', ARTICLE).og['og:image'];
    expect(json.image).toBe(og);
    expect(json.image).toMatch(/^https:\/\/rdmlabs\.dev\/og\/.+\.png$/);
  });

  it('dateModified é a última edição, ou a publicação quando nunca houve', () => {
    expect(json.dateModified).toBe('2025-09-09T00:00:00.000Z');
    const edited = articleJsonLd(SITE, 'pt', { ...ARTICLE, updatedAt: '2025-10-01T10:00:00.000Z' });
    expect(node(edited, 'BlogPosting').dateModified).toBe('2025-10-01T10:00:00.000Z');
  });

  it('declara quem publica, com o logo em URL absoluta', () => {
    expect(json.publisher).toEqual({
      '@type': 'Organization',
      name: SITE.siteName,
      url: 'https://rdmlabs.dev/',
      logo: { '@type': 'ImageObject', url: 'https://rdmlabs.dev/apple-touch-icon.png' },
    });
  });

  it('o breadcrumb vai da home do idioma ao artigo, com URL em todo nível', () => {
    expect(node(graph, 'BreadcrumbList').itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'RDM Labs', item: 'https://rdmlabs.dev/pt' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Code review sem atrito',
        item: 'https://rdmlabs.dev/pt/publicacoes/code-review-sem-atrito',
      },
    ]);
  });
});

describe('homeJsonLd', () => {
  const posts = [
    { slug: 'a', title: 'A', summary: 'Resumo A', publishedAt: '2026-01-01T12:00:00.000Z' },
    { slug: 'b', title: 'B', summary: 'Resumo B', publishedAt: '2025-01-01T12:00:00.000Z' },
  ];
  const graph = homeJsonLd(SITE, 'en', { title: 'T', description: 'D' }, posts);

  it('a home é o WebSite, no idioma da versão', () => {
    const json = node(graph, 'WebSite');
    expect(json.name).toBe(SITE.siteName);
    expect(json.url).toBe('https://rdmlabs.dev/en');
    expect(json.inLanguage).toBe('en-GB');
    expect(json.description).toBe('D');
  });

  it('e o Blog, com cada publicação do idioma em blogPost', () => {
    const blog = node(graph, 'Blog');
    expect(blog.url).toBe('https://rdmlabs.dev/en');
    expect(blog.blogPost).toEqual([
      {
        '@type': 'BlogPosting',
        headline: 'A',
        description: 'Resumo A',
        datePublished: '2026-01-01T12:00:00.000Z',
        url: 'https://rdmlabs.dev/en/publications/a',
      },
      {
        '@type': 'BlogPosting',
        headline: 'B',
        description: 'Resumo B',
        datePublished: '2025-01-01T12:00:00.000Z',
        url: 'https://rdmlabs.dev/en/publications/b',
      },
    ]);
  });

  it('o artigo declara fazer parte do Blog da home', () => {
    expect(node(articleJsonLd(SITE, 'en', ARTICLE), 'BlogPosting').isPartOf).toEqual({
      '@type': 'Blog',
      '@id': node(graph, 'Blog')['@id'],
    });
  });
});

describe('renderHeadTags', () => {
  const html = renderHeadTags(articleMeta(SITE, 'pt', ARTICLE), articleJsonLd(SITE, 'pt', ARTICLE));

  it('pede o cartão grande ao X, em name e não em property', () => {
    expect(html).toContain('<meta name="twitter:card" data-head content="summary_large_image">');
    expect(html).not.toContain('property="twitter:');
  });

  it('abre com o título', () => {
    expect(html).toContain('<title>Code review sem atrito · RDM Labs</title>');
  });

  it('marca cada tag como governada pelo cabeçalho', () => {
    expect(html).toContain('<link rel="canonical" data-head href=');
  });

  it('lista os três hreflang', () => {
    expect(html).toContain('hreflang="pt"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
  });

  it('leva o Open Graph', () => {
    expect(html).toContain('<meta property="og:type" data-head content="article">');
  });

  it('artigo não anuncia feed RSS; a home sim', () => {
    expect(html).not.toContain('application/rss+xml');
    const home = renderHeadTags(homeMeta(SITE, 'pt', { title: 'T', description: 'D' }), null);
    expect(home).toContain(
      '<link rel="alternate" data-head type="application/rss+xml" title="RSS" href="https://rdmlabs.dev/pt/rss.xml">',
    );
  });

  it('escapa aspas e sinais no conteúdo dos atributos', () => {
    const risky = renderHeadTags(
      articleMeta(SITE, 'pt', { ...ARTICLE, summary: 'Aspas " e <b> e & final' }),
      null,
    );
    expect(risky).toContain('content="Aspas &quot; e &lt;b&gt; e &amp; final"');
    expect(risky).not.toContain('<b>');
  });

  it('escapa o texto do título', () => {
    const risky = renderHeadTags(articleMeta(SITE, 'pt', { ...ARTICLE, title: 'A & B' }), null);
    expect(risky).toContain('<title>A &amp; B · RDM Labs</title>');
  });

  it('indexable: false acrescenta a meta robots noindex; o resto não tem a tag', () => {
    const html2 = renderHeadTags(articleMeta(SITE, 'pt', { ...ARTICLE, indexable: false }), null);
    expect(html2).toContain('<meta name="robots" data-head content="noindex">');
    expect(html).not.toContain('name="robots"');
  });

  it('não emite JSON-LD quando não há artigo', () => {
    expect(
      renderHeadTags(homeMeta(SITE, 'pt', { title: 'T', description: 'D' }), null),
    ).not.toContain('ld+json');
  });

  it('impede que o JSON-LD feche o próprio <script>', () => {
    const escaped = renderHeadTags(
      articleMeta(SITE, 'pt', ARTICLE),
      articleJsonLd(SITE, 'pt', { ...ARTICLE, title: 'Fim </script><script>alert(1)</script>' }),
    );
    expect(escaped).not.toContain('</script><script>');
    expect(escaped).toContain('\\u003c/script');
  });
});

describe('notFoundHeadTags', () => {
  const html = notFoundHeadTags('Não encontrado · RDM Labs', 'Este endereço não existe.');

  it('leva título e descrição', () => {
    expect(html).toContain('<title>Não encontrado · RDM Labs</title>');
    expect(html).toContain('content="Este endereço não existe."');
  });

  it('fica fora do índice', () => {
    expect(html).toContain('<meta name="robots" data-head content="noindex">');
  });

  it('não canoniza nem anuncia alternativas', () => {
    expect(html).not.toContain('canonical');
    expect(html).not.toContain('hreflang');
  });
});

describe('og:image', () => {
  it('o artigo aponta para o cartão dele, com URL absoluta', () => {
    const og = articleMeta(SITE, 'pt', ARTICLE).og;
    expect(og['og:image']).toBe(`https://rdmlabs.dev${ogImagePath(articleOgCard('pt', ARTICLE))}`);
    expect(og['og:image:width']).toBe('1200');
    expect(og['og:image:height']).toBe('630');
    expect(og['og:image:alt']).toBe('Code review sem atrito');
  });

  it('o cartão do artigo desenha título, categoria e data, no idioma da página', () => {
    expect(articleOgCard('en', ARTICLE)).toEqual({
      locale: 'en',
      title: 'Code review sem atrito',
      kicker: 'Artigo técnico',
      category: 'artigo',
      date: '2025-09-09',
    });
  });

  it('a home também tem cartão, com o nome do site no lugar da categoria', () => {
    const copy = { title: 'Entre no meu universo', description: 'Constelação.' };
    const og = homeMeta(SITE, 'pt', copy).og;
    expect(homeOgCard(SITE, 'pt', copy)).toEqual({
      locale: 'pt',
      title: 'Entre no meu universo',
      kicker: 'RDM Labs',
    });
    expect(og['og:image']).toBe(`https://rdmlabs.dev${ogImagePath(homeOgCard(SITE, 'pt', copy))}`);
  });

  it('não duplica a barra quando a origem termina nela', () => {
    const og = articleMeta({ ...SITE, origin: 'https://rdmlabs.dev/' }, 'pt', ARTICLE).og;
    expect(og['og:image']).toMatch(/^https:\/\/rdmlabs\.dev\/og\//);
  });
});
