# Prompt para o Claude Code — Fase 10: criação de publicações

Coloque esta pasta no repositório (por exemplo, em `docs/design/fase-10/`) e cole o texto abaixo no Claude Code.

---

## Prompt

Vamos para a **Fase 10: painel de criação de publicações (RDM Studio)**. As fases anteriores estão concluídas: a experiência pública do cosmos, a API pública e o modelo base de `publications` já existem.

Antes de escrever código, leia `docs/design/fase-10/README.md`. É a especificação completa desta fase: layout, comportamento de cada controle, regras de publicação, conversão de Markdown, modelo de dados e API. Leia também `docs/design/fase-10/prototype/RDM Studio.dc.html`, que é o protótipo de referência. **Não copie esse arquivo para produção.** O `support.js` ao lado é o runtime da ferramenta de design e deve ser ignorado. No protótipo os dados ficam no `localStorage`; aqui tudo passa pela API do Laravel e pelo PostgreSQL. As funções `parseMd` e `segs` do protótipo servem de referência para o parser de Markdown e a formatação em linha.

Depois de ler, inspecione o código existente e me diga, em poucas linhas, o que já existe e o que vai mudar (migrations, models, rotas) antes de começar.

### Escopo desta fase

1. **Banco de dados.** Migrations para separar o rascunho (`publication_drafts`) do conteúdo publicado (`publication_translations`). Blocos em `jsonb`. Tabelas de tags, referências e mídia. Novos campos em `publications`: `status` com `scheduled`, `featured`, `indexable` e `scheduled_for`. Migre os dados atuais sem perder nada.
2. **API do painel**, autenticada, conforme o README: listar, criar, autosave (`PATCH`), publicar, despublicar, excluir, enviar imagem e sugerir tags. Valide os blocos no servidor: tipos permitidos, alt obrigatório em imagens e URLs válidas.
3. **Publicação.** Ao publicar, copie o rascunho para o conteúdo publicado e gere `body_html` no servidor com o texto escapado, a formatação em linha suportada e syntax highlighting nos blocos de código. Atualize o `search_vector`. Publicações agendadas entram no ar por um job do scheduler na data definida. Ao publicar ou despublicar, invalide o cache da constelação e o sitemap.
4. **Imagens.** Envio para o storage do Laravel, redimensionamento para no máximo 1600px de largura, conversão para WebP e registro de largura e altura.
5. **SEO.** Título e descrição de SEO por idioma, com fallback para o título e o subtítulo. Quando `indexable` estiver desligado, gere `noindex` e retire a página do sitemap. Gere no servidor a imagem de compartilhamento 1200×630 com a estrela da categoria e o título, e use-a como `og:image`.
6. **Interface do painel** em React + TypeScript, fiel ao protótipo: três colunas responsivas, editor em blocos (parágrafo, intertítulo, código com Tab, citação e imagem com alt obrigatório), abas PT/EN com o botão de copiar a estrutura do PT, referências, pré-visualização idêntica à página de leitura, importação de Markdown com contagem de blocos em tempo real, lista de verificação, categoria, destaque, tags com sugestões, data, slug automático, seção de SEO com as prévias, exclusão em dois cliques, autosave com debounce e avisos breves de ação.

### Fora do escopo (não implemente e não deixe interface para isso)

Controle de versões, envio de imagem de compartilhamento pelo autor, papéis e permissões além do login atual, artigos relacionados e séries.

### Regras

- Use apenas os tokens de cor, fonte e raio do README; não invente estilos.
- A data da publicação continua definindo a posição da estrela. Nenhuma coordenada é gravada.
- O conteúdo publicado só muda quando o autor clica em publicar; o autosave altera apenas o rascunho.
- Escreva feature tests para publicar, agendar, despublicar, validar blocos, converter Markdown (no backend, se você validar lá também) e gerar `body_html`.
- Trabalhe em etapas: banco de dados → API → publicação e HTML → imagens e SEO → interface. Pare ao fim de cada etapa, diga o que testar e espere minha revisão.

Comece lendo o README e me dando o diagnóstico do código atual.
