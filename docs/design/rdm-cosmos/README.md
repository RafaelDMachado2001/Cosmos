# Handoff: RDM Labs — Cosmos

## Visão geral

Extensão experimental do portfólio de RDM Labs: uma experiência navegável onde artigos técnicos, estudos, projetos e registros de rotina aparecem como uma constelação temporal. O usuário entra por um núcleo orgânico 3D (portal), atravessa-o via scroll, chega a um cosmos horizontal onde cada publicação é uma estrela posicionada pela sua data, e abre o artigo avançando a câmera até a estrela.

Público: recrutadores, profissionais de tecnologia e visitantes do portfólio principal. A experiência precisa ser imersiva sem prejudicar leitura, performance ou SEO.

## Sobre os arquivos deste pacote

`prototype/RDM Cosmos.dc.html` é uma **referência de design criada em HTML** — um protótipo que demonstra aparência, movimento e comportamento pretendidos. **Não é código de produção para copiar.** `support.js` é apenas o runtime da ferramenta de design; ignore-o completamente na implementação.

A tarefa é **recriar este design no stack alvo** (React + TypeScript + Three.js no frontend, Laravel + PostgreSQL no backend, tudo em Docker), usando os padrões e bibliotecas desse ambiente. O shader GLSL do protótipo é a exceção: ele pode ser portado quase literalmente, pois é a especificação visual exata do núcleo.

## Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamentos, durações e curvas de animação do protótipo são finais. Recrie fielmente. Os textos das publicações no protótipo são fictícios (com uma exceção real, ver "Conteúdo") e servem apenas para popular a linha do tempo.

---

## Telas

### 1. Entrada (hero / portal)

Fundo `#05060B` em tela cheia, sem barra de rolagem visível (`overflow:hidden`, `overscroll-behavior:none` no body).

**Canvas WebGL** ocupa toda a viewport (`position:absolute; inset:0`), atrás de tudo. Sobre ele, uma vinheta radial não interativa:
`radial-gradient(130% 100% at 50% 48%, rgba(28,20,64,0.25) 0%, rgba(5,6,11,0) 38%, rgba(3,4,9,0.92) 100%)`.

**Núcleo 3D** centralizado horizontalmente, posicionado na faixa livre entre o rodapé do header e o topo do bloco de texto (ver "Enquadramento responsivo do núcleo").

**Bloco de texto** ancorado na base (o container é `display:flex; flex-direction:column; justify-content:flex-end; padding:0 24px 40px`), centralizado, com `gap: clamp(12px, 2.2vh, 22px)`:

| Elemento | Estilo | Conteúdo PT | Conteúdo EN |
|---|---|---|---|
| Kicker | JetBrains Mono 10.5px, `letter-spacing:0.34em`, `#8A8CA3` | `RDM LABS / COSMOS` | idem |
| Título | Roboto 300, `clamp(27px, min(5.2vw, 6.4vh), 64px)`, `line-height:1.06`, `letter-spacing:-0.02em`, `#F2F1FA`, `max-width:16ch`, `text-wrap:balance` | `Entre no meu universo` | `Enter my universe` |
| Subtítulo | Roboto 400, `clamp(13px, 1.7vh, 15px)`, `line-height:1.6`, `#9698B2`, `max-width:44ch`, `text-wrap:pretty` | `Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.` | `Articles, studies, projects and field notes arranged as a timeline constellation.` |

**Botão de entrada**, `margin-top: clamp(18px, 3.4vh, 34px)`: pílula transparente, borda `1px solid rgba(124,92,255,0.3)`, `border-radius:999px`, `padding:11px 20px`, texto JetBrains Mono 10px `letter-spacing:0.22em` cor `#A99BFF`, seguido de um traço de 22px×1px com gradiente `rgba(169,155,255,0.2) → #A99BFF`. Copy: `ROLE PARA ATRAVESSAR` / `SCROLL TO PASS THROUGH`. Hover: borda `rgba(124,92,255,0.8)`, texto `#fff`, fundo `rgba(124,92,255,0.1)`. Clicar equivale a completar o scroll de entrada.

**Header nesta tela:** apenas o botão de marca (ícone + `RDM LABS`) e o seletor PT/EN. Navegação e busca ficam com `opacity:0`, `transform:translateY(-10px)` e `pointer-events:none`.

### 2. Transição de portal

Controlada por um progresso `enter` de 0 a 1, alimentado por scroll, toque ou teclado — nunca por rolagem nativa da página. Ver "Modelo de interação".

Ao longo de `enter`:

- Hero: `opacity` cai de 1 a 0 na faixa `enter` 0.02→0.44; `transform: scale(1 + enter*0.5)`; `filter: blur(fade*8px)`; `pointer-events:none` quando o fade passa de 0.4.
- Câmera: `z` de 4.3 a 0.25 (`4.3 - enter*4.05`); `y` interpola de `baseY` para 0; `lookAt` acompanha.
- Núcleo: escala `baseScale * (1 + enter*2.9)`; amplitude do ruído `uAmp` de 0.34 a 0.84; opacidade do fragmento cai a 0 na faixa `enter` 0.5→0.92 (`uOpacity = 1 - max(0,(enter-0.5)/0.42)`).
- Esfera interna opaca (o "vazio" do núcleo) desaparece em `enter` 0→0.7.
- Poeira cósmica avança em `z` (`enter*6`), reforçando a sensação de atravessar.
- Cosmos: `opacity` sobe na faixa `enter` 0.62→0.96; `transform: scale(0.94 + reveal*0.06)`; ganha `pointer-events` só acima de 0.9.

Não há corte: as três camadas se sobrepõem continuamente.

### 3. Cosmos (constelação temporal)

Faixa horizontal muito mais larga que a viewport, deslocada por `translate3d`. Nunca use scroll nativo horizontal.

- **Eixo do tempo:** linha de 1px em `top:55%`, gradiente `rgba(124,92,255,0.02) → rgba(124,92,255,0.14) 30% → rgba(124,92,255,0.28)`. Passado à esquerda, presente à direita.
- **Marcadores de ano:** JetBrains Mono 10px, `letter-spacing:0.28em`, cor `#8285A0`, com filete vertical `1px solid rgba(124,92,255,0.18)` à esquerda e `padding-left:10px`.
- **Conectores:** entre estrelas consecutivas, linha de 1px rotacionada, gradiente `rgba(124,92,255,0.30) → rgba(124,92,255,0.06)`. Opacidade cai a 0.12 quando qualquer das duas pontas está filtrada.
- **Estrelas:** alvo de clique 58×58px centrado no ponto. Núcleo de 15px (22px em publicações destacadas), `border-radius:50%`, `background: radial-gradient(circle at 40% 38%, #ffffff 0%, <corCategoria> 42%, transparent 78%)`, `box-shadow: 0 0 22px 4px <cor>45`. Anel externo de 32px (46px em destaque) com `1px solid <cor>3a` — invisível em itens comuns até o hover.
- **Régua temporal** no rodapé (`bottom:14px`, `left/right:28px`): rótulos `PASSADO`/`HOJE` (`PAST`/`TODAY`), trilho de 1px com gradiente crescente à direita, marcador circular de 12px `#C4B5FF` com brilho, e legenda central `ARRASTE OU ROLE` / `DRAG OR SCROLL`. Alvo de arraste de 44px de altura.
- **Header nesta tela:** marca, navegação (`CONSTELAÇÃO`, `CATEGORIAS`, `PORTFÓLIO`), busca e PT/EN, todos visíveis, com transição de 600ms.

### 4. Painel de hover

Cartão translúcido ancorado à estrela, com `transform: translate(26px, -50%)`; inverte para `calc(-100% - 26px)` quando a estrela está a menos de 360px da borda direita.

`width:330px`, `background:rgba(11,12,22,0.82)`, `border:1px solid rgba(124,92,255,0.22)`, `border-radius:14px`, `padding:18px 20px`, `backdrop-filter:blur(20px)`, `box-shadow:0 24px 60px rgba(0,0,0,0.55)`, `pointer-events:none`.

Conteúdo, de cima para baixo: ponto de 7px na cor da categoria + rótulo da categoria (JetBrains Mono 9.5px, `0.22em`, `#9698B2`) + data alinhada à direita (`#7C7F99`); título (Roboto 400, 17px, `line-height:1.3`, `#F2F1FA`); resumo (13px, `line-height:1.6`, `#9698B2`); rodapé `CLIQUE PARA ABRIR` / `CLICK TO OPEN` em `#A99BFF`.

Estado hover da estrela: núcleo +7px, `box-shadow: 0 0 40px 10px <cor>80`, anel visível em `<cor>66` e `scale(1.25)`. Transição `420ms cubic-bezier(.4,0,.2,1)`.

### 5. Publicação (leitura)

**Sequência de abertura — a parte mais sensível do design.** Ao clicar:

1. `pan` é reposicionado para centralizar a estrela (`estrela.x - viewport/2`); o valor anterior é guardado para o retorno.
2. `zoom` vai de 0 a 1, interpolado a 0.055 por frame. A camada da constelação recebe `scale(1 + zoom*1.35)`, `transform-origin` no ponto da estrela, `filter: blur(zoom*3px)` e sua opacidade cai para 28%.
3. Após **760ms** (120ms se `prefers-reduced-motion`), a vista de leitura é montada e sobe de `opacity:0 / scale(1.06)` para `1 / scale(1)`, também interpolada por frame (0.085). Nada aparece instantaneamente.

**Layout desktop (≥780px):** grid de duas colunas, `minmax(200px, 25%) 1fr`, fundo `linear-gradient(180deg, #06070E, #05060B)`.

Coluna esquerda (estrela ampliada, `aria-hidden`, imóvel enquanto o texto rola) — todas as camadas na cor da categoria, empilhadas e centradas:

| Camada | Tamanho | Estilo | Animação |
|---|---|---|---|
| Aura | 150% da coluna | `radial-gradient(circle, <cor>26 0%, <cor>0d 35%, transparent 68%)` | `rdmHalo` 9s |
| Halo | `min(58%, 210px)` | `radial-gradient(circle, <cor>4d, <cor>1a 46%, transparent 72%)`, `blur(6px)` | `rdmHalo` 5.5s |
| Núcleo | `min(30%, 108px)` | `radial-gradient(circle at 40% 36%, #fff 0%, <cor> 44%, transparent 78%)`, `box-shadow: 0 0 70px 14px <cor>66, 0 0 160px 40px <cor>26` | `rdmBreathe` 4.5s |
| Anel | `min(46%, 168px)` | `1px solid <cor>3a` com `border-top-color: <cor>aa` | `rdmSpin` 26s linear |

Abaixo, data e posição na linha do tempo (`3 / 14 · MAI 2025`) em JetBrains Mono.

Coluna direita (artigo): rolagem vertical própria (`overflow-y:auto; overscroll-behavior:contain`), `padding: clamp(72px,9vh,104px) clamp(24px,5vw,72px) 96px`, borda esquerda `1px solid rgba(124,92,255,0.14)`, conteúdo com `max-width:70ch` centralizado.

Tipografia do artigo: metadados JetBrains Mono 9.5px; título Roboto 300 `clamp(30px, 3.4vw, 46px)`, `line-height:1.15`, `#F4F3FB`; lide 17px `line-height:1.65` `#B6B8CC`; filete gradiente; corpo 16px `line-height:1.78` `#A2A4BC`, parágrafos com `margin-bottom:22px`, `text-wrap:pretty`.

**Fechar:** botão "×" fixo em `top:24px; right:28px`, 46×46px, círculo `rgba(14,15,28,0.6)` com borda `rgba(255,255,255,0.09)` e `backdrop-filter:blur(14px)`; `aria-label` bilíngue. Há também o botão "VOLTAR À CONSTELAÇÃO" ao fim do artigo. Ambos revertem `zoom` a 0 e devolvem `pan` ao valor guardado — a câmera recua exatamente para o ponto de onde saiu. `Esc` faz o mesmo.

**Layout mobile (<780px):** o overlay inteiro vira o contêiner de rolagem (`overflow-y:auto`, linhas `auto auto`). A estrela ocupa uma faixa hero de `min-height:46vh` no topo e **rola junto com a página** — não é fixa. O artigo recebe `padding:40px 24px 88px` e borda superior em vez de lateral.

### 6. Busca

Campo no header (só no cosmos): pílula `rgba(14,15,28,0.5)`, borda `rgba(255,255,255,0.07)`, `border-radius:10px`, `padding:8px 12px`, `flex:1 1 120px; min-width:96px; max-width:240px`; ícone circular de 11px com borda `#6E7BFF`; input transparente, JetBrains Mono 11px; placeholder `buscar no cosmos…` / `search the cosmos…` em `#7C7F99`.

Filtra por título, resumo, rótulo de categoria e data. Estrelas não correspondentes vão a `opacity:0.07` com `pointer-events:none` e transição de **700ms** — apagam como estrelas perdendo intensidade, nunca somem de imediato. A câmera desliza suavemente até o primeiro resultado.

### 7. Categorias

Painel ancorado abaixo do header (`top:92px; left:20px`, `z-index:45`), `width:260px`, `rgba(11,12,22,0.82)`, borda `rgba(255,255,255,0.08)`, `border-radius:12px`, `backdrop-filter:blur(18px)`.

Cabeçalho `FILTRAR POR CATEGORIA`. Cada linha: ponto de 7px na cor + rótulo (Roboto 13px `#C9CBE0`) + contagem à direita. Ativa: fundo `rgba(124,92,255,0.16)`, borda `rgba(124,92,255,0.4)`. Clicar na categoria ativa remove o filtro. Primeira linha é `Tudo` / `All` em roxo.

### 8. Estado vazio

Centralizado, sem interação: `NENHUMA ESTRELA ENCONTRADA` / `NO STARS FOUND` (JetBrains Mono 11px, `0.22em`, `#8A8CA3`) e, abaixo, `Ajuste a busca ou remova o filtro de categoria.` / `Adjust the search or clear the category filter.` (13px, `#7C7F99`).

**Ainda a projetar:** estados de loading e erro. Recomendação: skeleton em que o eixo temporal e os marcadores de ano aparecem primeiro e as estrelas surgem com fade escalonado conforme os dados chegam; em erro, mesma composição do estado vazio com uma ação de repetir.

### 9. Retorno ao início

`goHome()` zera `enter` e `pan`. A interpolação faz o cosmos recuar, o núcleo reaparecer e a câmera voltar à posição inicial pelo mesmo caminho da entrada. O núcleo não é visível durante a exploração do cosmos — é a porta de entrada e só reaparece no retorno.

---

## Modelo de interação

Um único progresso contínuo em duas fases. `enter` (0→1) atravessa o portal; depois disso o mesmo gesto move `pan` (0→largura total). Ao rolar para trás, `pan` volta a 0 e só então `enter` retrocede.

| Entrada | Efeito |
|---|---|
| `wheel` | `preventDefault()`; `enter += deltaY * 0.00085` ou `pan += deltaY * 1.15` |
| Teclado | `←`/`→`, `PageUp`/`PageDown` = ±260; `Home` = voltar ao início; `Esc` = fechar artigo/painel |
| Toque | Arraste no eixo dominante × 2.4 |
| Arraste do cosmos | `pointerdown` na área, ganho de 1.35, cursor `grab`/`grabbing`, com inércia |
| Arraste da régua | Mapeia a posição horizontal do ponteiro diretamente para `pan` |

**Suavização (o ponto crítico do design).** Nada é aplicado diretamente: todo valor tem um par bruto/suavizado interpolado a cada frame por `s += (alvo - s) * k`.

| Valor | k normal | k com movimento reduzido |
|---|---|---|
| `enter` | 0.055 | 0.16 |
| `pan` | 0.062 | 0.30 |
| `zoom` (abertura do artigo) | 0.055 | 0.30 |
| Fade da vista de leitura | 0.085 | 0.30 |
| Posição do mouse | 0.05 | 0.05 |

Inércia do arraste: ao soltar, `velocidade *= 1.2` e decai `*0.955` por frame enquanto for maior que 0.15. Um clique é ignorado se o ponteiro percorreu mais de 6px — evita abrir artigo ao arrastar.

Considere usar Lenis ou equivalente no lugar da implementação manual de `wheel`, mantendo os mesmos coeficientes.

---

## O núcleo 3D

Malha `IcosahedronGeometry(1, detail)` com `detail = 7` no desktop e `5` abaixo de 780px, material `ShaderMaterial` com `transparent`, `depthWrite:false`, `AdditiveBlending`, `DoubleSide`. Dentro dela, uma `IcosahedronGeometry(0.72, 3)` opaca `#0a0714` que dá a impressão de um interior vazio. Ambas dentro de um `THREE.Group` posicionado e escalado conforme o enquadramento.

Câmera perspectiva 48°, `z = 4.3`. Renderer com `antialias`, `alpha`, `pixelRatio` limitado a **1.75**.

**Vertex shader.** Simplex noise 3D (`snoise`) em três oitavas somadas com pesos 0.30 / 0.13 / 0.05 e frequências 1.05 / 2.6 / 5.2, animadas em eixos diferentes (0.16 / 0.10 / 0.07). Deslocamento ao longo da normal por `uAmp`. Reação ao cursor: `smoothstep(0.55, 1.0, dot(normalize(pos), normalize(vec3(uMouse, 0.85)))) * 0.16` — a superfície incha na direção do ponteiro.

**Fragment shader.** Base: `mix(#0B081C, #2A1E65, smoothstep(-0.25, 0.35, ruído))`. Sobre ela, um **degradê angular** calculado por `atan(normal.y, normal.x)`, girando a 0.045 rad/s, percorrendo roxo `#7854FF` → verde `#3DDB8F` → laranja `#FF8F36` → vermelho `#ED3354` → roxo. Esse degradê é aplicado no fresnel (`pow(1 - dot(normal, view), 3.0)`) e nos veios internos (`pow(1 - abs(ruído*2.1), 9.0)`).

**Pulsos.** Um `uPulse` dispara para 1 em intervalos aleatórios de **1,4 a 5 segundos**, decai `*0.965` por frame e é modulado por `pulse² * (0.55 + 0.45*sin(t*5.5))`. Ele intensifica simultaneamente cor, veios e opacidade da borda — a leitura é de energia percorrendo a superfície. Com movimento reduzido, o decaimento vai a `*0.90` e o tempo do shader roda a 25% da velocidade.

**Enquadramento responsivo do núcleo.** Calculado a cada `resize`, nunca fixo:

```
bandTop    = alturaDoHeader + 14
bandBottom = topoDoBlocoDeTexto (getBoundingClientRect) - 24
band       = max(120, bandBottom - bandTop)
centerY    = bandTop + band / 2
radius     = min(band / 2 * 0.88, viewportWidth * 0.28)
visH       = 2 * 4.3 * tan(48° / 2)
baseScale  = max(0.22, radius * visH / (viewportHeight * 1.06))
baseY      = ((viewportHeight / 2 - centerY) / viewportHeight) * visH
```

O fator 0.88 reserva folga para o pico de deformação do shader. Meça a posição real do bloco de texto, não constantes — o protótipo teve dois bugs por causa disso.

**Armadilha de inicialização já resolvida no protótipo:** `window.innerWidth/Height` pode ser 0 no primeiro `mount`, produzindo `NaN` permanente. Aborte a medição se largura ou altura forem zero, marque para repetir, e re-meça via `ResizeObserver` **no container fixo raiz** (`document.documentElement` tem altura 0 num layout todo `position:fixed`), `visualViewport.resize`, evento `load`, `document.fonts.ready` e timers em 0/60/160/400/1000ms.

**Poeira cósmica.** `THREE.Points` com 1500 partículas (700 abaixo de 780px), distribuídas numa casca esférica de raio 6 a 32 achatada em `y` (×0.6). Shader próprio: `gl_PointSize = size * 260 * pixelRatio / -mvPosition.z`, alfa `smoothstep(0.5, 0, distância ao centro do ponto)` multiplicado por um fade de profundidade, cor `rgb(0.78, 0.76, 0.95)` a 55% — deliberadamente discreta.

---

## Design tokens

### Cores

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#05060B` | Fundo global |
| `bg-elev` | `#06070E` | Fundo da vista de leitura |
| `surface` | `rgba(11,12,22,0.82)` | Painéis translúcidos |
| `surface-nav` | `rgba(14,15,28,0.5)` | Pílulas do header |
| `border` | `rgba(255,255,255,0.07)` | Bordas neutras |
| `border-accent` | `rgba(124,92,255,0.22)` | Bordas com acento |
| `text-primary` | `#F2F1FA` | Títulos |
| `text-reading` | `#A2A4BC` | Corpo de artigo |
| `text-secondary` | `#9698B2` | Resumos |
| `text-muted` | `#8A8CA3` | Metadados (contraste ≥4.5:1) |
| `text-faint` | `#7C7F99` | Placeholders, datas |
| `accent` | `#8C6BFF` | Roxo dominante |
| `accent-soft` | `#A99BFF` | Links, chamadas |

Nunca use cinzas abaixo de `#7C7F99` sobre o fundo — a revisão de acessibilidade reprovou `#6E6F8C`, `#5D6079` e `#4C4F68`.

### Categorias

| Categoria | Slug | Cor | PT | EN |
|---|---|---|---|---|
| Artigo técnico | `artigo` | `#6E7BFF` | Artigo técnico | Technical article |
| Projeto | `projeto` | `#FF8A3D` | Projeto | Project |
| Estudo | `estudo` | `#4ADE9B` | Estudo | Study |
| Rotina | `rotina` | `#FF4D7E` | Rotina | Field notes |

O roxo domina; estas quatro cores funcionam apenas como sinal de navegação e classificação.

### Tipografia

**Roboto** (300/400/500) para leitura e títulos; **JetBrains Mono** (400/500) para metadados, navegação e rótulos. Todo texto em mono usa maiúsculas e `letter-spacing` entre 0.14em e 0.34em.

### Outros

Raios: 7px (item de menu), 10px (pílula), 12px (painel de categorias), 14px (painel de hover), 999px / 50% (pílulas e pontos). Blur: 14px (header), 18px (categorias), 20px (hover). Sombra de painel: `0 24px 60px rgba(0,0,0,0.55)`. Easing padrão: `cubic-bezier(.4,0,.2,1)`; durações 420ms (estrelas), 600ms (header), 700ms (filtro).

---

## Dados e arquitetura

### Modelo

```
publications
  id                 bigserial primary key
  slug               text unique not null
  category           text not null   -- artigo | projeto | estudo | rotina
  published_at       timestamptz not null
  featured           boolean default false
  status             text default 'draft'   -- draft | published
  created_at, updated_at

publication_translations
  id                 bigserial primary key
  publication_id     references publications on delete cascade
  locale             text not null   -- pt | en
  title              text not null
  summary            text not null
  body               text not null   -- markdown ou html sanitizado
  search_vector      tsvector generated
  unique (publication_id, locale)
```

Índices: `publications(published_at desc)`, `publications(category, published_at)`, GIN em `search_vector`.

### Posicionamento automático — requisito central

Nenhuma coordenada é armazenada. A posição de cada estrela é **derivada** e recalculada no cliente:

- `x = 300 + (dias desde a época da linha do tempo) * GAP`, com `GAP = 3.4` px/dia. Com centenas de publicações, torne `GAP` adaptativo (por exemplo, largura alvo dividida pelo intervalo total) e imponha um espaçamento mínimo entre pontos próximos no tempo.
- `y = 55% + (hash(slug) - 0.5) * 50%` — dispersão determinística: o mesmo slug sempre cai no mesmo lugar, e publicar um item novo não move os existentes.
- Hash: FNV-1a de 32 bits normalizado para 0–1. Reimplemente exatamente o mesmo algoritmo no frontend para manter as posições estáveis entre sessões.

Publicar no painel administrativo insere a linha; o endpoint público passa a retorná-la; a constelação a posiciona sozinha. Nenhuma edição de layout é necessária.

### API

- `GET /api/publications?locale=pt&category=&q=&before=&limit=` → lista enxuta (`slug`, `category`, `published_at`, `featured`, `title`, `summary`) para montar a constelação.
- `GET /api/publications/{slug}?locale=pt` → publicação completa.
- Busca via `websearch_to_tsquery` com dicionários `portuguese` e `english`, aplicada ao `search_vector`.

### SEO e acessibilidade estrutural

A camada 3D não pode esconder o conteúdo dos buscadores. Renderize no servidor uma rota de artigo legível (`/pt/publicacoes/{slug}`) com HTML semântico completo, `title`, `meta description`, Open Graph, JSON-LD `Article` e `hreflang` entre PT e EN. A experiência do cosmos é uma camada por cima; a navegação sem JavaScript deve levar a essas páginas. Gere `sitemap.xml` a partir das publicações publicadas.

### Acessibilidade

Cada estrela é um `<button>` real com `aria-label` no formato `título — categoria — data`, alcançável por Tab, com anel de foco visível (`2px solid #E8E9F2`, `outline-offset:2px`) e o mesmo painel do hover ao receber foco. O painel de leitura é um `<article>`; o "×" tem `aria-label` bilíngue e 46px. Respeite `prefers-reduced-motion` reduzindo as durações e acelerando as interpolações (coluna da tabela acima), nunca removendo funcionalidade. Nenhuma informação depende só de cor: categoria sempre aparece escrita.

Forneça um fallback sem WebGL: se a criação do contexto falhar, mantenha toda a interface DOM (a constelação inteira é HTML, não canvas) e substitua o núcleo por um gradiente radial estático animado em CSS.

### Performance

`pixelRatio` limitado a 1.75; `detail` da malha e contagem de partículas reduzidos abaixo de 780px; um único `requestAnimationFrame` para toda a cena; a constelação animada apenas por `transform`/`opacity` (nunca `left`/`top`); geometrias e materiais descartados no unmount. Para centenas de publicações, virtualize as estrelas fora da viewport (com margem) e pagine a API por janela temporal.

---

## Conteúdo

O protótipo traz 14 publicações. Apenas uma é real e deve ser preservada literalmente:

> `2026-09-09` — **Arquitetura e Osquestramento de LLMs** — Artigo técnico

(o título está grafado como o autor o escreveu; confirme com ele antes de corrigir para "Orquestração").

As outras 13 são fictícias, escritas para exercitar as quatro categorias e a distribuição temporal de 2024 a 2026. Substitua por conteúdo real.

---

## O que evitar

Aparência de dashboard ou de blog genérico; cards convencionais em excesso; neon; visual gamer; excesso de partículas; animações agressivas; scroll nativo visível; elementos decorativos sem função. O núcleo não deve reaparecer durante a exploração do cosmos. Nenhuma nova cor além das listadas.

---

## Arquivos

- `prototype/RDM Cosmos.dc.html` — protótipo completo (referência visual e de comportamento; contém os shaders GLSL prontos para portar).
- `prototype/support.js` — runtime da ferramenta de design. **Ignore.**
- `CLAUDE_CODE_PROMPT.md` — prompt de implementação pronto para colar no Claude Code.
