import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ARTICLE = '/pt/publicacoes/n-mais-1-o-custo-invisivel-do-eloquent';

const WIDE = { width: 1200, height: 800 };
const NARROW = { width: 390, height: 800 };

function horizontal(page: Page) {
  return page.locator('[data-orientation="right"] svg[role="img"]');
}

function vertical(page: Page) {
  return page.locator('[data-orientation="down"] svg[role="img"]');
}

test.describe('diagrama sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('horizontal no desktop', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(ARTICLE);
    await expect(horizontal(page)).toBeVisible();
    await expect(vertical(page)).toBeHidden();
    await expect(page.getByText('O caminho de uma request até o PHP', { exact: true }).last()).toBeVisible();
  });

  test('vertical no celular', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto(ARTICLE);
    await expect(vertical(page)).toBeVisible();
    await expect(horizontal(page)).toBeHidden();
  });
});

test.describe('cenários do diagrama', () => {
  test('sem JavaScript: visão geral por padrão, e o cenário 502 abre painel e camada', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: WIDE });
    const page = await context.newPage();
    await page.goto(ARTICLE);

    const panel = page.getByText('Bad Gateway', { exact: true }).locator('visible=true');
    await expect(panel).toHaveCount(0);

    await page.getByRole('radio', { name: '502' }).check({ force: true });
    await expect(panel).toBeVisible();
    await expect(horizontal(page).locator('[data-tone="broken"]').first()).toBeVisible();
    await expect(horizontal(page).locator('[data-tone="down"]').first()).toBeVisible();
    await expect(horizontal(page).locator('[data-state="3"] [data-badge="err"]')).toHaveCSS('display', 'inline');

    await page.getByRole('radio', { name: 'Visão geral' }).check({ force: true });
    await expect(panel).toHaveCount(0);
    await context.close();
  });

  test('o teclado troca de cenário, e o pacote anda sobre a aresta', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(WIDE);
    await page.goto(ARTICLE);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: 'Visão geral' })).toBeChecked({ timeout: 30_000 });
    await dialog.getByRole('radio', { name: 'Visão geral' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'GET /posts/42' })).toBeChecked();

    const packet = dialog.locator('[data-orientation="right"] [data-state="1"] circle');
    const svg = await dialog.locator('[data-orientation="right"] svg[role="img"]').boundingBox();
    await expect.poll(async () => (await packet.boundingBox())?.x ?? 0).toBeGreaterThan((svg?.x ?? 0) + 40);
    await expect(dialog.locator('[data-orientation="right"] [data-state="2"]')).toHaveCSS('display', 'none');
  });

  test('movimento reduzido não mostra o pacote', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', javaScriptEnabled: false, viewport: WIDE });
    const page = await context.newPage();
    await page.goto(ARTICLE);
    await page.getByRole('radio', { name: 'GET /posts/42' }).check({ force: true });
    await expect(page.getByText('Request dinâmica', { exact: true })).toBeVisible();
    await expect(horizontal(page).locator('[data-state="1"] circle')).toHaveCSS('display', 'none');
    await context.close();
  });
});

test.describe('espectro', () => {
  const SPECTRUM = '/pt/publicacoes/como-organizo-minha-semana-de-codigo';

  test('sem JavaScript: a zona troca o diagnóstico', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: WIDE });
    const page = await context.newPage();
    await page.goto(SPECTRUM);

    await expect(page.getByRole('radio', { name: 'Extração de menos' })).toBeChecked();
    await expect(page.getByText('Azedo, ralo, sem doçura', { exact: true }).locator('visible=true')).toBeVisible();

    await page.getByRole('radio', { name: 'Ponto certo' }).check({ force: true });
    await expect(page.getByText('Doce, equilibrado', { exact: true }).locator('visible=true')).toBeVisible();
    await expect(page.getByText('Azedo, ralo, sem doçura', { exact: true }).locator('visible=true')).toHaveCount(0);
    await context.close();
  });

  test('no celular não há rolagem horizontal', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: NARROW });
    const page = await context.newPage();
    await page.goto(SPECTRUM);
    await expect(page.getByRole('radio', { name: 'Ponto certo' })).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await context.close();
  });
});

test.describe('diagrama na vista de leitura', () => {
  for (const [name, viewport, shown] of [
    ['desktop', WIDE, 'right'],
    ['celular', NARROW, 'down'],
  ] as const) {
    test(`${name}: na cor da categoria e sem rolagem horizontal`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      await page.goto(ARTICLE);

      const dialog = page.getByRole('dialog');
      const svg = dialog.locator(`[data-orientation="${shown}"] svg[role="img"]`);
      await expect(svg).toBeVisible({ timeout: 30_000 });

      const accent = await svg.evaluate((element) => getComputedStyle(element).getPropertyValue('--cat').trim());
      expect(accent.toLowerCase()).toBe('#707cff');

      const overflow = await dialog.evaluate((element) => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        reader: element.scrollWidth - element.clientWidth,
      }));
      expect(overflow).toEqual({ page: 0, reader: 0 });
    });
  }
});
