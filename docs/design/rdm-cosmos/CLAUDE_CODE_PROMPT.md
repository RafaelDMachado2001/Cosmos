# Prompt para o Claude Code

Cole o texto abaixo na primeira mensagem do Claude Code, com este pacote (`README.md` e `prototype/`) na raiz do repositório.

---

## Prompt

Vamos construir o **RDM Labs Cosmos**: uma experiência web onde minhas publicações (artigos técnicos, estudos, projetos e registros de rotina) aparecem como uma constelação temporal navegável, com um núcleo 3D como portal de entrada.

Leia `README.md` deste repositório antes de escrever qualquer código. Ele é a especificação de design completa: cores exatas, tipografia, medidas, curvas de animação, comportamento de cada tela, o modelo de dados e a arquitetura pretendida. Leia também `prototype/RDM Cosmos.dc.html` — é o protótipo de referência em HTML, com os shaders GLSL já prontos. **Não copie esse arquivo para produção**: ele foi feito numa ferramenta de design e o `support.js` ao lado é apenas o runtime dela. Recrie o design no stack abaixo. Os shaders são a exceção: porte-os praticamente como estão, pois são a especificação visual exata do núcleo.

### Stack

- Frontend: React 18 + TypeScript + Vite, Three.js (via react-three-fiber, se preferir), Tailwind ou CSS Modules — sua escolha, desde que os tokens do README sejam a única fonte de verdade das cores.
- Backend: Laravel 11 + PostgreSQL 16, API JSON e painel administrativo separado da experiência pública.
- Tudo em Docker Compose: `app` (PHP-FPM), `web` (Nginx), `db` (Postgres), `node` (Vite em dev).

### Ordem de trabalho

Trabalhe em fases e pare ao fim de cada uma para eu revisar antes de seguir.

**Fase 1 — Fundação.** Docker Compose funcional, Laravel instalado, Postgres conectado, Vite servindo React com TypeScript, healthcheck respondendo. Migrations das tabelas `publications` e `publication_translations` conforme o README, com os índices e o `tsvector`. Seeder com as 14 publicações do protótipo (extraia-as do array `ITEMS` em `prototype/RDM Cosmos.dc.html`, com os textos PT e EN).

**Fase 2 — API.** Endpoints `GET /api/publications` (filtro por locale, categoria e busca full-text) e `GET /api/publications/{slug}`. Busca com `websearch_to_tsquery` usando os dicionários `portuguese` e `english`. Feature tests cobrindo filtro, busca e paginação.

**Fase 3 — Núcleo 3D.** A tela de entrada isolada: canvas em tela cheia, malha icosaédrica com o vertex shader de simplex noise em três oitavas, fragment shader com degradê angular roxo→verde→laranja→vermelho no fresnel, pulsos aleatórios de energia a cada 1,4–5s, poeira cósmica, reação ao cursor e ao toque. Implemente o cálculo de enquadramento responsivo exatamente como descrito no README, incluindo as proteções contra medida zero na inicialização (o protótipo teve dois bugs sérios aí; a seção "Armadilha de inicialização" lista as cinco fontes de re-medição necessárias).

**Fase 4 — Portal e cosmos.** O progresso contínuo `enter`/`pan` alimentado por wheel, teclado, toque e arraste, com a suavização por interpolação por frame da tabela do README — esse é o ponto mais sensível do projeto: nada pode parecer brusco, nenhum valor é aplicado direto ao DOM. A constelação é HTML posicionado por `transform`, não canvas (isso é o que garante acessibilidade e SEO). Régua temporal arrastável, marcadores de ano, conectores entre estrelas.

**Fase 5 — Interação com publicações.** Painel de hover, sequência de abertura em três tempos (centralizar, avançar 760ms com escala e desfoque, então montar a leitura com fade), vista de artigo com estrela fixa à esquerda no desktop e hero rolável no mobile, fechar por "×" ou Esc devolvendo a câmera ao ponto exato de origem.

**Fase 6 — Busca, filtros e estados.** Busca em tempo real com as estrelas não correspondentes indo a `opacity:0.07` em 700ms, filtro por categoria, estado vazio, loading (eixo temporal primeiro, estrelas com fade escalonado) e erro.

**Fase 7 — SEO, acessibilidade e painel administrativo.** Rotas de artigo renderizadas no servidor com HTML semântico, JSON-LD `Article`, Open Graph, `hreflang` PT/EN e sitemap. Auditoria de acessibilidade: navegação completa por teclado, foco visível, `prefers-reduced-motion`, fallback sem WebGL. CRUD administrativo (Filament ou Blade, sua escolha) atrás de autenticação, separado da experiência pública.

### Regras que valem para todas as fases

- As posições das estrelas são **sempre derivadas** de data e de um hash FNV-1a do slug — nunca armazenadas, nunca escritas à mão. Publicar um item novo deve fazê-lo aparecer na constelação sem nenhuma edição de layout, e não pode mover os itens existentes.
- O sistema precisa suportar centenas de publicações: espaçamento temporal adaptativo, virtualização das estrelas fora da viewport e paginação por janela temporal.
- Bilíngue PT/EN em toda a interface e em todo o conteúdo.
- A camada 3D complementa o conteúdo; jamais o esconde dos buscadores.
- Não invente cores, fontes ou espaçamentos fora dos tokens do README.
- Antes de cada fase, me diga em duas ou três linhas o que vai fazer. Ao fim, me diga o que testar e o que ficou pendente.

Comece pela Fase 1.
