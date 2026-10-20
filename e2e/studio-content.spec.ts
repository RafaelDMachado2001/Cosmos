import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Um texto com todos os tipos de bloco, nas duas línguas, com uma imagem
 * enviada pelo upload do painel: do Markdown importado no editor até a página
 * que o job grava e a vista de leitura que a Shell abre por cima dela.
 *
 * O `studio.spec.ts` prova o ciclo publicar/despublicar com dois blocos; este
 * prova que nenhum tipo se perde no caminho rascunho -> Markdown -> página.
 * Mesmas condições: stack inteira e `E2E_ADMIN_COOKIE`.
 */
const cookie = process.env.E2E_ADMIN_COOKIE;

test.skip(cookie === undefined, 'sem E2E_ADMIN_COOKIE: precisa da stack com backend');

test.setTimeout(300_000);
const JOB_TIMEOUT = 180_000;

/** Um PNG de 2x2, para o upload não depender de arquivo no repositório. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGOoifkPRAwQCgAxhgddSzQ72AAAAABJRU5ErkJggg==',
  'base64',
);

const BODY = {
  pt: `## Intertítulo da prova

Um parágrafo com **negrito**, *itálico*, \`código\` e um [link](https://example.com).

### Subtítulo da prova

> Uma citação comum.

- primeiro item
- segundo item

1. passo um
2. passo dois

> [!highlight]
> Uma frase em destaque.

> [!note] Título da nota
> O texto da nota.

> [!flow]
> Etapa A
> Etapa B
> Etapa C

| Coluna | Valor |
| :--- | ---: |
| alfa | 1 |
| beta | 2 |

\`\`\`ts title="estrelas.ts"
const estrelas = 42;
\`\`\``,
  en: `## Proof heading

A paragraph with **bold** and a [link](https://example.com).

> [!note] Note title
> The note text.

| Column | Value |
| --- | --- |
| alpha | 1 |`,
};

async function importMarkdown(page: Page, markdown: string): Promise<void> {
  await page.getByRole('button', { name: 'Importar Markdown' }).click();
  await page.getByPlaceholder('Cole aqui o Markdown').fill(markdown);
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
}

async function expectPtBody(article: Locator): Promise<void> {
  await expect(article.locator('h2', { hasText: 'Intertítulo da prova' })).toHaveCount(1);
  await expect(article.locator('h3', { hasText: 'Subtítulo da prova' })).toHaveCount(1);
  await expect(article.locator('p strong', { hasText: 'negrito' })).toHaveCount(1);
  await expect(article.locator('p em', { hasText: 'itálico' })).toHaveCount(1);
  await expect(article.locator('a[href="https://example.com"]')).toHaveCount(1);
  await expect(article.locator('blockquote', { hasText: 'Uma citação comum.' })).toHaveCount(1);
  await expect(article.locator('ul li')).toHaveText(['primeiro item', 'segundo item']);
  await expect(article.locator('ol li', { hasText: 'passo' })).toHaveText(['passo um', 'passo dois']);
  await expect(article.getByText('Uma frase em destaque.')).toHaveCount(1);
  await expect(article.locator('[role="note"]')).toContainText('Título da nota');
  await expect(article.locator('[role="note"]')).toContainText('O texto da nota.');
  await expect(article.locator('ol li', { hasText: /^Etapa/ })).toHaveText(['Etapa A', 'Etapa B', 'Etapa C']);
  await expect(article.locator('table th')).toHaveText(['Coluna', 'Valor']);
  await expect(article.locator('table td[data-align="right"]')).toHaveText(['1', '2']);
  await expect(article.locator('figure figcaption', { hasText: 'estrelas.ts' })).toHaveCount(1);
  await expect(article.locator('pre code')).toHaveText('const estrelas = 42;');
  const image = article.locator('figure img[alt="Um quadrado de teste"]');
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute('src', /^\/storage\//);
  await expect(article.locator('figure figcaption', { hasText: 'Legenda da imagem' })).toHaveCount(1);
}

test('todos os blocos e uma imagem enviada chegam ao site nas duas línguas', async ({ page, baseURL, request }) => {
  const { name, value } = JSON.parse(cookie ?? '{}') as { name: string; value: string };
  await page.context().addCookies([{ name, value, url: baseURL ?? 'http://localhost:8080' }]);

  await page.goto('/admin/studio');
  await page.getByRole('button', { name: '+ Nova' }).click();

  const title = `E2E Blocos ${String(Date.now())}`;
  await page.getByPlaceholder('Título', { exact: true }).fill(title);
  await page.getByPlaceholder(/^Subtítulo/).fill('Resumo da prova');
  await importMarkdown(page, BODY.pt);

  // A imagem entra depois do código, o último bloco importado.
  await page.getByRole('textbox', { name: 'Código', exact: true }).focus();
  await page.getByRole('button', { name: '+ Imagem' }).click();
  await page.getByPlaceholder('Texto alternativo').fill('Um quadrado de teste');
  await page.getByPlaceholder('Legenda (opcional)').fill('Legenda da imagem');
  await page.locator('input[type="file"]').setInputFiles({ name: 'quadrado.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByPlaceholder('URL da imagem')).toHaveValue(/\/storage\//);
  const imageUrl = await page.getByPlaceholder('URL da imagem').inputValue();

  await page.getByRole('tab', { name: 'English' }).click();
  await page.getByPlaceholder('Título', { exact: true }).fill(`${title} EN`);
  await page.getByPlaceholder(/^Subtítulo/).fill('Proof summary');
  await importMarkdown(page, BODY.en);

  const slug = await page.getByLabel('Slug').inputValue();
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible();

  const image = await request.get(new URL(imageUrl, baseURL).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toMatch(/^image\//);

  const ptUrl = `/pt/publicacoes/${slug}`;
  const enUrl = `/en/publications/${slug}`;
  for (const [url, expected] of [
    [ptUrl, title],
    [enUrl, `${title} EN`],
  ] as const) {
    await expect
      .poll(
        async () => {
          const response = await request.get(url);
          const body = await response.text();
          return response.status() === 200 && body.includes(expected) && !body.includes('noindex');
        },
        { timeout: JOB_TIMEOUT, intervals: [2_000, 5_000] },
      )
      .toBe(true);
  }

  await page.goto(ptUrl);
  await expectPtBody(page.locator('#prerender article'));
  await expectPtBody(page.getByRole('dialog').locator('article'));

  await page.goto(enUrl);
  for (const article of [page.locator('#prerender article'), page.getByRole('dialog').locator('article')]) {
    await expect(article.locator('h2', { hasText: 'Proof heading' })).toHaveCount(1);
    await expect(article.locator('[role="note"]')).toContainText('Note title');
    await expect(article.locator('table td')).toHaveText(['alpha', '1']);
  }

  await page.goto('/admin/studio');
  await page.getByText(title).first().click();
  await page.getByRole('button', { name: 'Despublicar' }).click();
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();
  await expect
    .poll(async () => (await request.get(ptUrl)).status(), { timeout: JOB_TIMEOUT, intervals: [2_000, 5_000] })
    .toBe(404);
  await page.getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
