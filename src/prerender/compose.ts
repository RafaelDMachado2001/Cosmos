import type { PrerenderedPage } from './pages';

export const SLOT = '<div id="prerender"></div>';

const LANG = /<html lang="[^"]*">/;

const TEMPLATE_TITLE = /[ \t]*<title>[\s\S]*?<\/title>\n?/;
const TEMPLATE_DESCRIPTION = /[ \t]*<meta\s+name="description"[\s\S]*?>\n?/;

export function compose(template: string, page: PrerenderedPage, css: string): string {
  return template
    .replace(LANG, () => `<html lang="${page.lang}">`)
    .replace(TEMPLATE_TITLE, '')
    .replace(TEMPLATE_DESCRIPTION, '')
    .replace('</head>', () => `${page.head}\n<style data-head>${css}</style>\n</head>`)
    .replace(SLOT, () => `<div id="prerender">${page.body}</div>`);
}
