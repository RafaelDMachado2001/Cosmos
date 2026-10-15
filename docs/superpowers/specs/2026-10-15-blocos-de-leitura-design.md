# Blocos de leitura — desenho da fase 11

Estado: aprovado em 15/10/2026. Sucede a fase 10 (atmosfera e UX do cosmos).
Corresponde à "Spec B" citada em `docs/superpowers/specs/2026-09-18-publicacao-viva-design.md`.

## O problema

O corpo de uma publicação hoje é `readonly string[]`: parágrafos de texto puro,
sem nenhuma formatação. Três sintomas:

- `ArticlePage.tsx` e `ReaderView.tsx` duplicam o mesmo `body.map((p) => <p>{p}</p>)`
  — exatamente o par que o `CLAUDE.md` já marca como pendente ("`ArticleBody`
  único").
- O banco guarda um `text` só (`PublicationTranslation::body`) e é o **servidor**
  quem decide dividir em parágrafos (`PublicationDetailResource::paragraphs`,
  regex em linha-em-branco) — a mesma regra, hoje, existe três vezes: lá,
  de novo em `FallbackController::show` e implicitamente em
  `scripts/emit-seed.ts` (`body.join('\n\n')`).
- Não há como escrever um título de seção, uma lista, uma citação ou um bloco de
  código dentro de um artigo. Para um acervo de artigos técnicos, isso é a
  lacuna que mais pesa.

## Decisão: um subconjunto de Markdown, parseado uma vez em TypeScript

**O banco continua guardando um `text` só.** Trocar para uma coluna JSON de
blocos estruturados moveria a complexidade para o schema e duplicaria a
decisão de formato entre o Filament e o parser — e todo o acervo semente teria
que nascer já estruturado. Markdown continua sendo o formato de autoria: é o
que já se escrevia (parágrafos separados por linha em branco já são Markdown
válido), e dá para estender sem quebrar o que já existe.

**Quem interpreta o Markdown é o `core/blocks.ts`, em TypeScript, uma vez.**
Mesmo princípio do `core/seo.ts` na fase 9 ("o Laravel não ganha nenhuma lógica
de SEO"): o backend guarda e devolve a string crua; `parseBlocks(markdown)`
mora em `src/core/` — puro, sem DOM, testado — e roda tanto no prerender
(Node) quanto no cliente (browser). `PublicationDetailResource::paragraphs` e
a divisão equivalente duplicada seriam a segunda implementação do mesmo
parser — exatamente o que a fase 9 recusou para SEO. `FallbackController`
é a única exceção que permanece: é caminho de erro, já declarado fora de
escopo de qualquer rendering real, e seu split por linha-em-branco continua
servindo uma casca de texto puro suficiente para `noindex`.

**O subconjunto é fechado e pequeno, não um Markdown completo.** Blocos:
título de seção (`##`, `###`), parágrafo, citação (`>`), lista (`-`/`1.`),
bloco de código (` ``` `), imagem (`![alt](src "legenda")`). Inline: **negrito**,
_itálico_, `código`, [link](url). Sem tabelas, sem HTML embutido, sem listas
aninhadas, sem itens de lista em múltiplas linhas. Cada um desses cortes é
deliberado: o acervo é de artigos técnicos de um autor só, não um CMS
genérico, e cada recurso a mais é uma nova superfície de parsing para manter e
testar. Nada impede estender a lista depois.

**Sem HTML no caminho.** O parser nunca produz uma string HTML para injetar
via `dangerouslySetInnerHTML` — produz uma árvore de nós (`Block[]`,
`InlineNode[]`) que o React renderiza como elementos normais. Texto continua
escapado pelo próprio React; não há sanitização de HTML porque não há HTML.
O único vetor que resta é a URL de link e imagem, e por isso `href`/`src`
passam por uma lista de protocolos aceitos (`http:`, `https:`, `mailto:`,
raiz-relativo `/...`, âncora `#...`) — uma URL fora dela perde o link e sobra
como texto, nunca é descartada.

**`ArticleBody` é o único lugar que desenha um bloco.** Recebe `markdown:
string`, chama `parseBlocks` uma vez (`useMemo`) e renderiza. `ArticlePage` e
`ReaderView` passam a só montar `<ArticleBody markdown={...} />` em vez de
mapear parágrafos — é o que fecha o item do `CLAUDE.md`.

## Migração de dados

**Sem migração de schema.** A coluna `publication_translations.body` já é
`text`; hoje guarda "parágrafos separados por linha em branco", que é
Markdown válido sem nenhum marcador. Trocar o tipo TypeScript de
`readonly string[]` para `string` e deixar de dividir no servidor é
suficiente — o conteúdo existente continua renderizando, só que agora como
parágrafos interpretados pelo parser em vez de pré-divididos pelo servidor.

**O acervo semente ganha um exemplo de cada bloco.** `src/data/publications.ts`
hoje repete um `DEMO_BODY` de três parágrafos fixos; passa a incluir também um
título de seção, uma lista e uma citação, para que a suíte e a revisão visual
exercitem todos os tipos sem exigir publicação nova.

## Contrato da API

`PublicationDetailResource::toArray` troca `'body' => self::paragraphs(...)`
por `'body' => $this->resource->body` — a string crua. É uma mudança de
contrato (`body` deixa de ser `string[]` e passa a ser `string`); como a API
ainda não tem consumidor fora deste repositório, não há período de
compatibilidade a manter. `PublicationApiTest` é reescrito para o novo
contrato.

## O editor no painel

`Textarea::make('body')` troca por `MarkdownEditor::make('body')`
(`filament/forms`, já na dependência via `filament/filament`), restrito à
barra de ferramentas que o parser entende — negrito, itálico, link, título,
citação, bloco de código, lista com e sem marcador. Sem tabela e sem upload de
arquivo: nenhum dos dois tem bloco correspondente nesta fase, e a barra
inteira do Filament incluiria os dois por padrão. Uma imagem continua
possível digitando `![alt](url)` à mão — raro o bastante, neste acervo, para
não justificar uma segunda infraestrutura (disco público, URLs temporárias)
só para um botão.

## Testes

- `core/blocks.ts`: um caso por tipo de bloco e por marcação inline, mais:
  bloco de código preservando linha em branco interna; lista que para na
  primeira linha que não casa o marcador; link/imagem com protocolo recusado
  caindo para texto simples; Markdown vazio devolvendo lista vazia, não erro.
- `ArticleBody`: renderiza os seis tipos de bloco com a tag semântica esperada
  (`h2`/`h3`, `blockquote`, `ul`/`ol`, `pre code`, `figure img`).
- Backend: `PublicationApiTest` passa a esperar `string` em `data.body` e a
  comparar o texto completo entre os dois idiomas, não mais o primeiro
  parágrafo.
- `scripts/emit-seed.ts`, `PublicationsSource`, `prerender/pages`, `synthetic`:
  ajustados ao novo tipo; nenhuma mudança de comportamento fora do que a
  mudança de tipo exige.

## Fora de escopo

Tabelas, HTML embutido, upload de imagem pelo painel, listas aninhadas,
numeração de código, destaque de sintaxe. Tudo em "Painel profissional"
(spec C, fase 12): login com Google, allowlist, throttle, publicação
agendada, `updated_at` no `lastmod`, RSS.

## Critérios de aceite

1. Um artigo com título de seção, citação, lista e bloco de código no corpo
   renderiza os quatro corretamente tanto na vista de leitura (overlay) quanto
   na página pré-renderizada (`ArticlePage`), a partir do mesmo componente.
2. Nenhum HTML arbitrário digitado no painel é interpretado como marcação —
   aparece como texto.
3. Um link ou imagem com `javascript:`/outro protocolo não aceito nunca é
   clicável nem carrega: o texto permanece, sem o elemento.
4. `npm run check` e a suíte do backend (`pint --test`, PHPStan nível 8,
   `artisan test`) passam.
