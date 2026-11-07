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
