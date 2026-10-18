/**
 * Ponte entre o Laravel e `core/draftBlocks.ts`.
 *
 * O painel administrativo roda em PHP; a gramática de blocos mora em
 * TypeScript puro, testada uma vez (ver `core/draftBlocks.ts`). Em vez de
 * reescrever a gramática em PHP — a mesma regra que levou `RegenerateSite`
 * a chamar `node dist-ssr/prerender.js` por `Process` — este CLI lê
 * stdin e escreve stdout, chamado da mesma forma.
 *
 * `markdown-to-blocks`: stdin é Markdown, stdout é o JSON de `DraftBlock[]`.
 * Usado só na migração de dados (`artisan rdm-studio:seed-drafts`).
 *
 * `blocks-to-markdown`: stdin é o JSON de `DraftBlock[]`, stdout é o
 * Markdown. Usado ao publicar (etapa 3).
 */
import { blocksToDraftBlocks, draftBlocksToMarkdown } from '../src/core/draftBlocks';
import type { DraftBlock } from '../src/core/draftBlocks';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const input = await readStdin();

  if (command === 'markdown-to-blocks') {
    process.stdout.write(JSON.stringify(blocksToDraftBlocks(input)));
    return;
  }

  if (command === 'blocks-to-markdown') {
    const blocks = JSON.parse(input) as readonly DraftBlock[];
    process.stdout.write(draftBlocksToMarkdown(blocks));
    return;
  }

  process.stderr.write(`comando desconhecido: ${String(command)}\n`);
  process.exitCode = 1;
}

await main();
