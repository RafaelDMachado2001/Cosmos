import { expect, test } from '@playwright/test';
import type { Browser, Locator } from '@playwright/test';

const cookie = process.env.E2E_ADMIN_COOKIE;

test.skip(cookie === undefined, 'sem E2E_ADMIN_COOKIE: precisa da stack com backend');

test.setTimeout(300_000);
const JOB_TIMEOUT = 180_000;

async function staticArticle(browser: Browser, url: string): Promise<{ article: Locator; close: () => Promise<void> }> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(url);
  return { article: page.locator('#prerender article'), close: () => context.close() };
}

test('publicar mostra no site o que o editor mostrava; despublicar tira do ar', async ({
  page,
  baseURL,
  request,
  browser,
}) => {
  const { name, value } = JSON.parse(cookie ?? '{}') as { name: string; value: string };
  await page.context().addCookies([{ name, value, url: baseURL ?? 'http://localhost:8080' }]);

  await page.goto('/admin/studio');
  await page.getByRole('button', { name: '+ Nova' }).click();

  const title = `E2E Studio ${String(Date.now())}`;
  await page.getByPlaceholder('Título', { exact: true }).fill(title);

  await page.getByRole('button', { name: '+ Parágrafo' }).click();
  await page.getByRole('textbox', { name: 'Parágrafo', exact: true }).fill('1984. Foi o ano em que **tudo** mudou.');
  await page.getByRole('button', { name: '+ Código' }).click();
  await page.getByRole('textbox', { name: 'Linguagem' }).fill('ts');
  await page.getByRole('textbox', { name: 'Código', exact: true }).fill('const estrelas = 42;');

  const slug = await page.getByLabel('Slug').inputValue();
  expect(slug).toMatch(/^e2e-studio-\d+$/);

  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar publicado' })).toBeVisible();

  const url = `/pt/publicacoes/${slug}`;
  await expect
    .poll(
      async () => {
        const response = await request.get(url);
        const body = await response.text();
        return response.status() === 200 && body.includes(title) && !body.includes('noindex');
      },
      { timeout: JOB_TIMEOUT, intervals: [2_000, 5_000] },
    )
    .toBe(true);

  const shell = await staticArticle(browser, new URL(url, baseURL).href);
  await page.goto(url);
  for (const article of [shell.article, page.getByRole('dialog').locator('article')]) {
    await expect(article.locator('p', { hasText: '1984. Foi o ano em que tudo mudou.' })).toHaveCount(1);
    await expect(article.locator('ol')).toHaveCount(0);
    await expect(article.locator('p strong', { hasText: 'tudo' })).toHaveCount(1);
    await expect(article.locator('pre code')).toHaveText('const estrelas = 42;');
    await expect(article.locator('pre code span', { hasText: 'const' })).toHaveCount(1);
  }
  await expect(page.getByRole('dialog').getByText('1984. Foi o ano em que')).toBeVisible();
  await shell.close();

  await page.goto('/admin/studio');
  await page.getByText(title).click();
  await page.getByRole('button', { name: 'Despublicar' }).click();
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();

  await expect
    .poll(async () => (await request.get(url)).status(), { timeout: JOB_TIMEOUT, intervals: [2_000, 5_000] })
    .toBe(404);

  await page.getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
