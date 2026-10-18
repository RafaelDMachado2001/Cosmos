# Handoff: RDM Studio — painel de criação de publicações

## Visão geral

Painel administrativo onde o autor cria, edita e publica as publicações que aparecem como estrelas no RDM Cosmos. É separado da experiência pública, mas segue a mesma identidade visual. O foco é funcional: escrever bem, classificar, preparar para SEO e publicar.

Esta fase **não** inclui: controle de versões, imagem de compartilhamento (Open Graph) enviada pelo autor, autenticação/papéis, artigos relacionados/séries. Esses itens ficam para fases futuras — não implemente nem deixe UI para eles.

## Sobre os arquivos deste pacote

`prototype/RDM Studio.dc.html` é uma **referência de design em HTML** — demonstra aparência e comportamento pretendidos. **Não é código de produção.** `support.js` é apenas o runtime da ferramenta de design; ignore-o.

No protótipo, os dados ficam no `localStorage` do navegador. Na implementação, tudo passa pela API do Laravel e pelo PostgreSQL. As funções `parseMd` e `segs` do protótipo são boas referências de comportamento para o parser de Markdown e para a formatação em linha.

## Fidelidade

**Alta fidelidade** em cores, tipografia, espaçamentos e comportamento. Os tokens são os mesmos do RDM Cosmos (ver handoff anterior); os principais estão repetidos abaixo.

---

## Layout

Página inteira com fundo `#05060B` e um brilho roxo discreto no canto superior esquerdo: `radial-gradient(90% 60% at 0% 0%, rgba(40,28,96,0.22), transparent 60%)`.

**Header fixo no topo** (altura mínima 64px, fundo `rgba(5,6,11,0.86)` com `backdrop-filter: blur(14px)`, borda inferior `rgba(255,255,255,0.06)`):
- Marca RDM LABS (pílula com ponto roxo brilhante), que leva ao cosmos.
- Rótulo `/ ESTÚDIO`.
- Status de salvamento: `SALVO ÀS 14:32`.
- Alternância `EDITAR` / `PRÉ-VISUALIZAR`.
- Botão principal de publicação (ver "Publicação").

**Três colunas** a partir de 1180px: `290px | 1fr | 330px`, altura `calc(100vh - 64px)`, cada coluna com rolagem própria.
- Entre 760px e 1179px: duas colunas (`250px | 1fr`). A lista fica fixa à esquerda e o painel de metadados desce para baixo do editor.
- Abaixo de 760px: uma coluna só. Lista com altura máxima de 42vh, depois editor, depois metadados.

Meça a largura de forma robusta: ignore leituras zeradas e meça de novo com `ResizeObserver`/`matchMedia`. O protótipo teve esse bug.

---

## Coluna 1 — Lista de publicações

- Cabeçalho `PUBLICAÇÕES · N` e botão `+ NOVA`.
- Busca por título (PT e EN) e por tags.
- Filtro de status: `TODAS`, `RASCUNHOS`, `PUBLICADAS`, `AGENDADAS`.
- Itens ordenados por data, da mais recente para a mais antiga. Cada item tem um ponto de 8px na cor da categoria, o título (13.5px) e uma linha em mono com status e data.
- Cores de status: rascunho `#8A8CA3`, publicado `#4ADE9B`, agendado `#FF8A3D`.
- Item selecionado: fundo `rgba(124,92,255,0.12)` e borda `rgba(124,92,255,0.35)`.

## Coluna 2 — Editor

Largura máxima de 780px, centralizado.

**Barra superior:** abas de idioma `PT` / `EN`. Quando a tradução EN está incompleta, aparece o aviso `TRADUÇÃO EN INCOMPLETA` em `#FF8A3D`. À direita, a contagem `N PALAVRAS · N MIN`, calculada a 200 palavras por minuto.

**Título e subtítulo:** editados direto, sem moldura de campo, no mesmo estilo da leitura. Título em Roboto 300, `clamp(28px, 3vw, 40px)`, cor `#F4F3FB`. Subtítulo em 17px, cor `#B6B8CC`. Na aba EN, o placeholder mostra o texto em PT como referência.

**Slug automático:** gerado a partir do título em PT (sem acentos, minúsculo, com hífens) até o autor editar o slug à mão.

**Corpo em blocos.** Cada bloco é um cartão com fundo `rgba(14,15,28,0.42)`, borda `rgba(255,255,255,0.06)` e raio de 12px (borda roxa no hover). O cartão tem o rótulo do tipo e botões para subir, descer e remover.

| Tipo | Edição | Leitura |
|---|---|---|
| Parágrafo | Textarea 15.5px, altura automática | 16px, `line-height:1.78`, `#A2A4BC` |
| Intertítulo | Textarea 22px | `h2` 23px, `#F2F1FA` |
| Código | Textarea mono 13px, fundo `#090A14`, sem quebra de linha. **Tab insere 2 espaços.** Tem campo de linguagem. | `figure` com cabeçalho (linguagem + botão `COPIAR`) e linhas numeradas, rolagem horizontal |
| Citação | Textarea 18px peso 300 | Aspa em mono roxa e texto 19px `#D8D2FF` |
| Imagem | Área de soltar/selecionar arquivo ou URL, **texto alternativo obrigatório** (borda laranja quando falta), legenda opcional | `figure` com a imagem na proporção original e legenda em mono |

**Formatação em linha** em parágrafos e citações: `**negrito**`, `` `código` `` e `[texto](url)`. Na leitura viram, respectivamente, peso 500, chip de código e link roxo sublinhado. Uma linha de ajuda abaixo da barra de blocos explica isso.

**Barra de blocos:** botões `+ PARÁGRAFO`, `+ INTERTÍTULO`, `+ CÓDIGO`, `+ CITAÇÃO`, `+ IMAGEM` e, à direita, `COLAR MARKDOWN`.

**Imagens:** envio por arrastar, selecionar ou URL. Redimensione no servidor para no máximo 1600px de largura, gere WebP e guarde no storage do Laravel. Guarde também largura e altura para que a leitura reserve o espaço certo (evita layout shift).

**Tradução EN vazia:** aparece o botão `COPIAR ESTRUTURA DO PT PARA TRADUZIR`, que duplica os blocos do PT, código e imagens incluídos.

**Referências:** lista numerada com título e URL, compartilhada entre PT e EN. Na leitura aparece no fim do artigo como `[1] Título` com a URL abaixo. O cabeçalho é `REFERÊNCIAS` em PT e `REFERENCES` em EN.

**Pré-visualização:** renderiza exatamente como a página de leitura do cosmos, no idioma ativo, com metadados, título, subtítulo, blocos, referências e tags.

### Importar Markdown

Janela modal (fecha com Esc ou "×") com um campo de texto em mono e a escolha entre `SUBSTITUIR CONTEÚDO` e `ADICIONAR AO FINAL`. Antes de importar, mostra quantos blocos foram reconhecidos e se um título foi detectado. Regras de conversão:

- Um `#` no início vira o título da publicação.
- `##` a `######` viram intertítulo.
- Cercas ``` viram bloco de código; a linguagem é lida da cerca.
- `>` vira citação; linhas seguidas de `>` são unidas.
- `![alt](url "legenda")` vira bloco de imagem.
- Listas `-`/`*`/`+` viram parágrafo com uma linha por item, começando com `•`. Listas numeradas mantêm a numeração.
- Linhas seguidas de texto são unidas num parágrafo; linha em branco separa parágrafos.
- `---` é ignorado.
- Formatação em linha é mantida.

Implemente o parser no frontend (para a contagem em tempo real) e valide de novo no backend ao salvar.

## Coluna 3 — Metadados

Seções separadas por `1px rgba(255,255,255,0.06)`, cada uma com título em mono 9.5px e espaçamento de letras 0.24em.

1. **Estrela e status.** Prévia da estrela na cor da categoria (aura, núcleo e anel girando em 26s). Se a publicação estiver em destaque, núcleo e anel ficam maiores. Abaixo, a pílula de status, uma linha de contexto (`No ar · 09 SET 2026`, `Alterações não publicadas · …`, `Entra no ar em …`) e, quando publicada, o botão `DESPUBLICAR`.
2. **Antes de publicar.** Lista de verificação com marcador roxo aceso quando o item está ok: título em PT, subtítulo em PT, corpo com conteúdo, pelo menos uma tag, imagens com texto alternativo, descrição para buscadores, tradução EN completa. Ela orienta, mas não bloqueia: o único requisito para publicar é ter título em PT.
3. **Categoria.** Quatro opções em grade 2×2 com a cor de cada categoria. Abaixo, a chave `Destaque na constelação`.
4. **Tags.** Chips removíveis. Uma tag nova é criada com Enter ou vírgula e normalizada como slug. O painel sugere tags já usadas em outras publicações.
5. **Data e endereço.** Data de publicação (é ela que define a posição da estrela na linha do tempo) e slug com o prefixo `/publicacoes/`.
6. **SEO e compartilhamento.** Campos separados para PT e EN. O idioma ativo aparece no cabeçalho da seção.
   - Título para buscadores, com contador `N / 60` que fica laranja acima do limite. Em branco, usa o título do artigo.
   - Descrição, com contador `N / 160` e o mesmo comportamento. Em branco, usa o subtítulo.
   - Chave `Indexar nos buscadores`. Desligada, gera `noindex` e tira a página do sitemap.
   - Prévia na busca: URL, título e descrição.
   - Prévia do card: imagem **gerada automaticamente** com a estrela da categoria sobre fundo escuro, o domínio, o título e a descrição. Na implementação, gere essa imagem no servidor (1200×630, com o título e a estrela na cor da categoria) e use-a como `og:image`.
7. **Excluir.** Exige dois cliques: `EXCLUIR PUBLICAÇÃO` → `CONFIRMAR EXCLUSÃO`.

---

## Publicação

O rascunho é **salvo automaticamente** cerca de 400ms depois da última alteração. O header mostra o horário do último salvamento.

O botão principal muda conforme o estado:

| Estado | Rótulo | Ação |
|---|---|---|
| Rascunho, data de hoje ou passada | `PUBLICAR` | status vira `published` |
| Rascunho, data futura | `AGENDAR` | status vira `scheduled`; um job publica na data |
| Publicada, editada depois | `PUBLICAR ALTERAÇÕES` | substitui o conteúdo público |
| Publicada, sem alterações | `PUBLICADO` / `AGENDADO` (inativo) | — |

Rascunho e conteúdo publicado são **separados**: editar uma publicação no ar não muda o que o público vê até clicar em `PUBLICAR ALTERAÇÕES`. No protótipo isso é feito com um `publishedSnap`, uma cópia do conteúdo publicado; para detectar alterações, os dois lados são normalizados antes de comparar. Despublicar volta a publicação para rascunho.

Publicar sem título em PT é bloqueado com o aviso `Adicione o título em PT antes de publicar`.

Cada ação mostra um aviso breve em pílula na base da tela por cerca de 2,4s.

---

## Dados (complemento ao modelo do Cosmos)

```
publications
  + status            text   -- draft | published | scheduled
  + featured          boolean
  + indexable         boolean default true
  + scheduled_for     timestamptz null

publication_drafts               -- conteúdo de trabalho (autosave)
  publication_id, locale, title, subtitle, blocks jsonb, seo_title, seo_description, updated_at

publication_translations         -- conteúdo publicado (o que a API pública serve)
  publication_id, locale, title, subtitle, blocks jsonb, body_html, seo_title, seo_description, search_vector

publication_tags (publication_id, tag_id)
tags (id, slug unique)

publication_references
  id, publication_id, position, title, url

media
  id, path, width, height, mime, alt_default, created_at
```

**Blocos em JSON**, uma lista ordenada:

```json
[
  { "id": "a1", "type": "p", "text": "Texto com **negrito** e `código`." },
  { "id": "a2", "type": "h2", "text": "Intertítulo" },
  { "id": "a3", "type": "code", "lang": "typescript", "text": "const x = 1;" },
  { "id": "a4", "type": "quote", "text": "Citação" },
  { "id": "a5", "type": "img", "media_id": 12, "alt": "Descrição", "caption": "Legenda" }
]
```

Ao publicar, gere `body_html` no servidor a partir dos blocos. Esse HTML é o que a rota pública de leitura e os buscadores consomem. Escape todo o texto e permita só a formatação em linha suportada. Aplique syntax highlighting nos blocos de código no servidor (por exemplo, com Shiki ou highlight.php), usando um tema com os tons do sistema.

## API do painel (autenticada)

- `GET /admin/api/publications?status=&q=`
- `POST /admin/api/publications` cria um rascunho vazio.
- `PATCH /admin/api/publications/{id}` faz o autosave de metadados e rascunho (com debounce no cliente).
- `POST /admin/api/publications/{id}/publish` copia o rascunho para o conteúdo publicado e define `published` ou `scheduled`.
- `POST /admin/api/publications/{id}/unpublish`
- `DELETE /admin/api/publications/{id}`
- `POST /admin/api/media` envia uma imagem e devolve `id`, `url`, `width` e `height`.
- `GET /admin/api/tags?q=` lista tags para as sugestões.

Ao publicar ou despublicar, invalide os caches da constelação pública e o sitemap.

## Tokens usados

Fundo `#05060B`; superfícies `rgba(14,15,28,0.42–0.6)`; bordas `rgba(255,255,255,0.06–0.09)`; acento `#8C6BFF` (botão principal com texto `#0B0818`); acento suave `#A99BFF`; texto `#F4F3FB` / `#E8E9F2` / `#C9CBE0` / `#9698B2` / `#8A8CA3` / `#7C7F99` (nada mais escuro que isso para texto); aviso `#FF8A3D`; perigo `#FF4D7E`. Cores das categorias: artigo técnico `#6E7BFF`, projeto `#FF8A3D`, estudo `#4ADE9B`, rotina `#FF4D7E`. Fontes: Roboto (300/400/500) e JetBrains Mono (400/500), com rótulos em mono maiúsculo e espaçamento de letras de 0.14em a 0.26em. Raios: 6px (controles pequenos), 8px (campos), 10px (pílulas e botões), 12px (blocos), 16px (modal).

## Acessibilidade

- Todos os controles são elementos nativos com rótulo.
- Foco visível: `2px solid #A99BFF`.
- As chaves (destaque e indexação) usam `role="switch"` e `aria-checked`.
- O modal usa `role="dialog"` e `aria-modal`, e fecha com Esc.
- O texto alternativo das imagens é obrigatório para passar na lista de verificação.
- A tecla Tab só insere espaços dentro do bloco de código; Esc sai do campo.

## Arquivos

- `prototype/RDM Studio.dc.html`: protótipo funcional (referência visual e de comportamento).
- `prototype/support.js`: runtime da ferramenta de design. **Ignore.**
- `CLAUDE_CODE_PROMPT.md`: prompt pronto para o Claude Code.
