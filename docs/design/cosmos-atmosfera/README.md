# Handoff: RDM Cosmos — Atmosfera e refinamentos de UX

## Visão geral

Esta fase é uma evolução visual e de UX da constelação pública que já existe. O objetivo é preencher melhor o espaço com elementos cósmicos gerados proceduralmente, sem tirar o foco das publicações, e corrigir pontos de navegação. Não há mudanças de dados nem de API.

## Sobre os arquivos

`prototype/RDM Cosmos.dc.html` é a **referência de design em HTML**: o protótipo atualizado da experiência completa. **Não é código de produção.** `support.js` é o runtime da ferramenta de design; ignore. O shader de fundo (`BG_FRAG`) e o gerador procedural (`layout()`) podem ser portados quase literalmente, porque são a especificação exata do efeito.

## Fidelidade

**Alta fidelidade.** Valores, coeficientes e cores abaixo são finais.

---

## 1. Atmosfera procedural

Uma nova camada WebGL, desenhada **antes** do núcleo 3D, no mesmo renderer (`autoClear = false`; limpar, desenhar o fundo, desenhar a cena). É um shader de tela cheia sobre um `PlaneGeometry(2,2)` com câmera ortográfica. Só aparece dentro do cosmos: a intensidade é multiplicada por `reveal`, então fica invisível na entrada e acompanha o fade da travessia do portal. Na abertura de um artigo, cai para 45% (`reveal * (1 - zoom*0.55)`).

### 1.1 Geração: procedural, determinística e espalhada pela linha do tempo

Calculada **uma vez**, quando as publicações carregam:

```
seed = hash_fnv1a(ids das publicações unidos por '|') * 1e9
R    = mulberry32(seed)
x    = 120
enquanto x < larguraDaLinhaDoTempo + 600:
  r = R()
  se r < 0.58                     → nebulosa
  senão se x - ultimaGalaxia > 2400 → galáxia (raras: no mínimo 2400px entre elas)
  senão                           → vazio (respiro)
  x += 460 + R() * 560
```

- Com a mesma lista de publicações, o resultado é sempre o mesmo. Uma publicação nova muda a semente, e o céu se recompõe sozinho, sem nenhuma edição manual.
- **Nebulosa:** `{ px: x*0.6, yf: 0.22..0.78, r: 220..500, w: 0.30..0.75, cor }`. A cor mistura o roxo base `rgb(0.40, 0.27, 0.92)` com 32–52% da cor da categoria da **publicação mais próxima** em `x`, de modo que cada região tinge levemente o céu à sua volta.
- **Galáxia:** `{ px: x*0.3, yf: 0.18..0.80, size: 70..160, squash: 0.32..0.72, ang: 0..π, brilho: 0.30..0.55 }`.

Os valores `px` já incluem o fator de parallax da camada: 0.6 para nebulosas e 0.3 para galáxias.

### 1.2 Culling por frame

A cada frame, envie ao shader apenas o que está na tela (com margem): até **8 nebulosas** no desktop e **5 abaixo de 780px**, e até **3 galáxias**, por uniform arrays (`uNeb[8]`, `uNebC[8]`, `uNebN`, `uGal[3]`, `uGalB[3]`, `uGalN`). Assim o custo é constante, seja qual for o tamanho da linha do tempo.

### 1.3 Shader

- **Estrelas de fundo em três profundidades**, geradas por grade com hash (sem buffers):

| Camada | Célula | Densidade | Brilho | Parallax |
|---|---|---|---|---|
| distante | 22px | 9% | 0.38 | 0.12 |
| média | 44px | 10% | 0.62 | 0.30 |
| próxima | 96px | 13% | 0.95 | 0.55 |

  Cada estrela tem cintilação senoidal (0.7–1.0, com frequência própria), núcleo nítido e halo exponencial suave. A cor varia entre lavanda `rgb(0.76,0.73,1.0)` e um quente pálido `rgb(1.0,0.86,0.76)`.

- **Galáxias:** espiral logarítmica de dois braços, `cos(2·(θ − 3·ln(r)))` elevado a 2.5, com disco `exp(−2.2r)` e núcleo `exp(−9r)`, achatada e rotacionada. Giram muito devagar (0.03 rad/s).

- **Nebulosas:** fbm de 5 oitavas com *domain warping* em três escalas (0.0026, 0.0072, 0.018). As três camadas definem as nuvens (`smoothstep(0.44, 0.98, …) × 0.36`), os filamentos (`× 0.24`) e as **faixas escuras de poeira** (`smoothstep(0.55, 0.75, n3) × 0.55`, que subtraem). Cada nebulosa é uma máscara gaussiana elíptica (`1.6 × r` na horizontal), multiplicada pela sua cor e peso. Deriva lenta no tempo.

- **Dithering** de ±0,5/255 no final, para eliminar as faixas visíveis no degradê (banding).

- A saída é aditiva sobre o fundo `#05060B`. O alfa é o maior valor entre R, G e B.

### 1.4 Anos gigantes

Camada DOM própria, atrás da constelação, com `pointer-events:none`, `aria-hidden` e parallax de **0.75**. Numerais em Roboto 300, `min(36vh, 340px)`, `letter-spacing:-0.05em`, cor `rgba(169,155,255,0.045)`, centralizados verticalmente em `x_ano * 0.75`.

### 1.5 Proporção

Os elementos ficam sempre abaixo das estrelas das publicações em brilho e contraste, e nenhum tem interação. Se algum deles chamar mais atenção que uma publicação, está forte demais.

---

## 2. Linha do tempo por mês

- O espaçamento passou de 3.4 para **4.6 px por dia**.
- **Marcador para cada mês**, do primeiro mês com dados até o mês da publicação mais recente:
  - Janeiro: `JAN 2024`, 9.5px, filete `rgba(169,155,255,0.45)`, `padding-top:16px`.
  - Demais meses: só o mês (`FEV`, `MAR`…), 8.5px, `padding-top:10px`.
  - Meses **com** publicação: texto `#B4A8FF` e filete `rgba(169,155,255,0.3)`. Meses **sem** publicação: texto `#7C7F99` e filete `rgba(124,92,255,0.14)`.
  - Todos em JetBrains Mono, `letter-spacing:0.22em`, ancorados no eixo em `top:55%`.
- O eixo ficou mais suave: `linear-gradient(90deg, transparent, rgba(124,92,255,0.07) 20%, rgba(124,92,255,0.12))`.
- Rótulos de mês em PT e EN via `toLocaleDateString(locale, { month:'short' })`, sem o ponto final.

## 3. Estrelas das publicações

- Duas vezes maiores: núcleo de **30px** (44px em destaque), mais 10px no hover. Área de clique de **88×88px**.
- Brilho duplo: `0 0 42px 8px <cor>4a, 0 0 110px 24px <cor>1c`. No hover: `70px 16px <cor>80, 160px 40px <cor>1c`.
- Anel de 58px (78px em destaque).
- **Rótulo sempre visível** abaixo da estrela, a `tamanho/2 + 22px`, com 180px de largura e centralizado:
  - Título curto: até cerca de 40 caracteres, cortado na última palavra inteira e terminado com reticências. Roboto 12.5px, `#C9CBE0`, no máximo 2 linhas, `text-wrap:balance`.
  - Data: mono 9px, `#8A8CA3`, no formato `FEV 2024`, sem o "de".
  - No hover o rótulo faz fade-out em 360ms e o painel completo assume. O painel agora fica a 58px da estrela e passa para o lado esquerdo quando a estrela está a menos de 400px da borda direita.

## 4. Navegação

- **Velocidade:** o ganho da roda do mouse sobre o deslocamento caiu de 1.15 para **0.62**. O arraste caiu de 1.35 para **1.0** e a inércia de 1.15 para 0.9. A travessia do portal (`enter`) não mudou.
- **Voltar ao início:** o primeiro item da navegação agora é `← INÍCIO` / `← START`, que leva à entrada pelo mesmo caminho da travessia.
- **Toque no mobile:** o primeiro toque numa estrela abre o painel, com a chamada `TOQUE DE NOVO PARA ABRIR` / `TAP AGAIN TO OPEN`. O segundo toque na mesma estrela abre o artigo. Tocar numa área vazia fecha o painel. Use `pointerType` para diferenciar toque de mouse; com mouse, um clique abre direto.

## 5. Arraste sem seleção de texto (obrigatório)

O arraste da linha do tempo **nunca** pode selecionar texto: anos, meses, rótulos, painel ou régua. Aplique as três medidas:

1. `user-select:none`, `-webkit-user-select:none` e `-webkit-touch-callout:none` em toda a área do cosmos, na camada dos anos e na régua. Os marcadores de mês recebem também `pointer-events:none`.
2. No `pointerdown` do cosmos e da régua, chame `preventDefault()` quando `pointerType === 'mouse'` e limpe qualquer seleção existente com `getSelection().removeAllRanges()`.
3. `onDragStart → preventDefault()` na área do cosmos, para impedir o arrasto nativo de imagens e textos.

O `preventDefault` no `pointerdown` não impede o clique nas estrelas: ele cancela só a seleção e o foco por mouse. O foco por teclado continua funcionando.

## 6. Núcleo da entrada

A esfera interna opaca (`#0a0714`), que parecia um furo, foi trocada por um **brilho interno**: `IcosahedronGeometry(0.8, 4)` com blending aditivo e um shader de "fresnel invertido" (mais forte no centro). O gradiente vai de `rgb(0.16,0.09,0.42)` a `rgb(0.70,0.58,1.0)`, com intensidade `0.40 + 0.28·pulso`, acompanhando os pulsos de energia da borda. Na travessia, apaga na faixa `enter` 0→0.7.

---

## Performance

- O fundo é uma única passada de tela cheia, com custo fixo por pixel. As nebulosas são a parte mais cara: 3 fbm de 5 oitavas.
- Abaixo de 780px, ou em GPUs fracas (detecte pelo tempo de frame, por exemplo uma média acima de 20ms por um segundo), desenhe o fundo num render target com **metade da resolução** e amplie. Se ainda estiver pesado, reduza para 3 oitavas.
- Com `prefers-reduced-motion`, o tempo do shader corre a 30% da velocidade.
- Sem WebGL: substitua o fundo por um `radial-gradient` estático roxo e mantenha a camada DOM dos anos.

## Arquivos

- `prototype/RDM Cosmos.dc.html`: protótipo atualizado (`BG_FRAG`, `layout()`, `tick()`).
- `prototype/support.js`: ignore.
- `CLAUDE_CODE_PROMPT.md`: prompt para o Claude Code.
