import { expect, test } from '@playwright/test';

/**
 * O RDM Studio de ponta a ponta: escrever, publicar, ver no site público com a
 * mesma formatação, despublicar e ver a página sumir.
 *
 * Precisa da stack inteira (API, fila, job de regeração) e de uma sessão do
 * admin — o login é só por Google. `E2E_ADMIN_COOKIE` é o JSON que
 * `php artisan e2e:admin-session` imprime; sem ele (o job `e2e` do CI, que só
 * sobe o `web` com o acervo semente), o teste é pulado. Roda no job
 * `integração`.
 */
const cookie = process.env.E2E_ADMIN_COOKIE;

test.skip(cookie === undefined, 'sem E2E_ADMIN_COOKIE: precisa da stack com backend');

// O job de regeração roda o prerender inteiro; no CI leva dezenas de segundos.
test.setTimeout(300_000);
const JOB_TIMEOUT = 180_000;

test('publicar mostra no site o que o editor mostrava; despublicar tira do ar', async ({
  page,
  baseURL,
  request,
}) => {
  const { name, value } = JSON.parse(cookie ?? '{}') as { name: string; value: string };
  await page.context().addCookies([{ name, value, url: baseURL ?? 'http://localhost:8080' }]);

  await page.goto('/admin/studio');
  await page.getByRole('button', { name: '+ Nova' }).click();

  const title = `E2E Studio ${String(Date.now())}`;
  await page.getByPlaceholder('Título', { exact: true }).fill(title);

  // Os dois casos que mais quebravam: um parágrafo que parece lista numerada e
  // um bloco de código, que agora sai com highlighting.
  await page.getByRole('button', { name: '+ Parágrafo' }).click();
  await page.getByRole('textbox', { name: 'Parágrafo', exact: true }).fill('1984. Foi o ano em que **tudo** mudou.');
  await page.getByRole('button', { name: '+ Código' }).click();
  await page.getByRole('textbox', { name: 'Linguagem' }).fill('ts');
  await page.getByRole('textbox', { name: 'Código', exact: true }).fill('const estrelas = 42;');

  const slug = await page.getByLabel('Slug').inputValue();
  expect(slug).toMatch(/^e2e-studio-\d+$/);

  // Sem esperar o autosave: publicar descarrega o salvamento pendente antes.
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible();

  const url = `/pt/publicacoes/${slug}`;
  await expect
    .poll(
      async () => {
        const response = await request.get(url);
        const body = await response.text();
        // Sem noindex: é o arquivo que o job gravou, não a casca do @app.
        return response.status() === 200 && body.includes(title) && !body.includes('noindex');
      },
      { timeout: JOB_TIMEOUT, intervals: [2_000, 5_000] },
    )
    .toBe(true);

  // As duas leituras do mesmo corpo: o HTML que o job gravou (o que um
  // crawler e quem está sem JavaScript recebem) e a vista de leitura que a
  // Shell abre por cima dele. Os dois passam por ArticleBody.
  await page.goto(url);
  for (const article of [page.locator('#prerender article'), page.getByRole('dialog').locator('article')]) {
    await expect(article.locator('p', { hasText: '1984. Foi o ano em que tudo mudou.' })).toHaveCount(1);
    await expect(article.locator('ol')).toHaveCount(0);
    await expect(article.locator('p strong', { hasText: 'tudo' })).toHaveCount(1);
    await expect(article.locator('pre code')).toHaveText('const estrelas = 42;');
    await expect(article.locator('pre code span', { hasText: 'const' })).toHaveCount(1);
  }
  await expect(page.getByRole('dialog').getByText('1984. Foi o ano em que')).toBeVisible();

  await page.goto('/admin/studio');
  // Só a lista mostra o título enquanto nada está selecionado.
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
