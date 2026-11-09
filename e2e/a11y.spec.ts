import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function violations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include !== undefined) builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`);
}

test.describe('acessibilidade (axe, WCAG 2.1 AA)', () => {
  test('entrada', async ({ page }) => {
    await page.goto('/pt');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('vista de leitura com o fim do artigo', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/pt/publicacoes/code-review-sem-atrito');
    const end = page.locator('#comentarios');
    await end.scrollIntoViewIfNeeded({ timeout: 30_000 });
    expect(await violations(page, '[role="dialog"]')).toEqual([]);
  });

  test('privacidade', async ({ page }) => {
    await page.goto('/pt/privacidade');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('minha conta', async ({ page }) => {
    await page.goto('/en/account');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
