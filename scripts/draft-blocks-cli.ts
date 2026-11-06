import { blocksToDraftBlocks, draftBlocksToMarkdown } from '../src/core/draftBlocks';
import type { DraftBlock } from '../src/core/draftBlocks';
import { validateDiagramBlocks } from '../src/core/draftValidation';

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

  if (command === 'validate-diagrams') {
    const blocks = JSON.parse(input) as readonly DraftBlock[];
    process.stdout.write(JSON.stringify(validateDiagramBlocks(blocks)));
    return;
  }

  process.stderr.write(`comando desconhecido: ${String(command)}\n`);
  process.exitCode = 1;
}

await main();
