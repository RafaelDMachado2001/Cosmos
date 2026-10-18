import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** As estrelas da constelacao, nao as ancoras do StarIndex: so elas tem o rotulo longo. */
function stars(page: Page): Locator {
  return page.locator('a[aria-label*=" — "]');
}

async function enterCosmos(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Role para atravessar' }).click();
  const star = stars(page).first();
  // Clicavel so depois da travessia: antes disso a constelacao e `inert`.
  await expect(star).toBeVisible();
  // O padrao de 5s do Playwright e menor que o proprio orcamento de quadro
  // que essa transicao amortecida pode levar no Chromium headless sem GPU
  // do GitHub Actions — o teste falhava aqui mesmo com a transicao correta,
  // so mais lenta do que o limite padrao da asserção aguenta.
  await expect(page.locator('[inert] a[aria-label*=" — "]')).toHaveCount(0, { timeout: 30_000 });
  return star;
}

test('abrir uma estrela troca a URL, e voltar fecha a vista de leitura', async ({ page }) => {
  // O unico teste que atravessa entrar + abrir + fechar: tres transicoes
  // amortecidas em sequencia. O timeout padrao de 30s e justo o bastante no
  // hardware do GitHub Actions para sobrar tempo zero de folga.
  test.setTimeout(60_000);

  await page.goto('/pt');
  const star = await enterCosmos(page);

  await star.click();
  await expect(page).toHaveURL(/\/pt\/publicacoes\/[a-z0-9-]+$/);
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/pt$/);
  // Mesmo motivo do inert acima: o fechamento tambem e uma transicao
  // amortecida, e o mesmo hardware lento ja fez essa asserção estourar o
  // padrao de 5s em pelo menos uma execução real do CI.
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
});

test('um slug que nao existe responde 404 de verdade', async ({ page }) => {
  const response = await page.goto('/pt/publicacoes/nao-existe');
  expect(response?.status()).toBe(404);
});

test('o segmento do outro idioma nao vira segunda URL do mesmo artigo', async ({ page }) => {
  const response = await page.goto('/pt/publications/code-review-sem-atrito');
  expect(response?.status()).toBe(404);
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('o artigo chega inteiro no HTML', async ({ page }) => {
    const response = await page.goto('/pt/publicacoes/code-review-sem-atrito');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code review sem atrito');
    expect(await page.locator('#prerender p').count()).toBeGreaterThan(2);
  });

  test('a home lista o acervo como links', async ({ page }) => {
    await page.goto('/pt');
    await expect(page.locator('#prerender a[href^="/pt/publicacoes/"]').first()).toBeVisible();
  });
});

test('a CSP do Nginx não bloqueia nada do próprio site', async ({ page }) => {
  test.setTimeout(60_000);
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  const response = await page.goto('/pt');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");

  // A travessia monta o WebGL, as fontes e a constelação; abrir uma estrela,
  // a vista de leitura com o corpo do artigo.
  const star = await enterCosmos(page);
  await star.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goto('/en/publications/code-review-sem-atrito');
  await expect(page.getByRole('dialog')).toBeVisible();

  expect(violations).toEqual([]);
});
