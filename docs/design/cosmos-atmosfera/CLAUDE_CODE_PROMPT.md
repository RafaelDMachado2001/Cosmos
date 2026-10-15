# Prompt para o Claude Code — Atmosfera e UX do Cosmos

Coloque esta pasta em `docs/design/cosmos-atmosfera/` e cole o texto abaixo.

---

## Prompt

Vamos evoluir a **experiência pública do Cosmos**, que já está implementada. Esta fase é só visual e de UX: não muda dados, API nem painel administrativo.

Leia `docs/design/cosmos-atmosfera/README.md` antes de começar; é a especificação completa. Depois leia `docs/design/cosmos-atmosfera/prototype/RDM Cosmos.dc.html`, o protótipo de referência. **Não copie o arquivo para produção**, e ignore o `support.js`. Porte quase literalmente:
- o fragment shader `BG_FRAG` (fundo: estrelas, galáxias e nebulosas);
- o gerador procedural dentro de `layout()` (semente pelos ids, `mulberry32`, distribuição de nebulosas e galáxias, cor pela publicação mais próxima);
- o culling por frame em `tick()`.

Antes de codar, inspecione a implementação atual da cena Three.js e da camada DOM da constelação. Em poucas linhas, me diga onde cada mudança vai entrar.

### Entregas, em ordem

1. **Seleção de texto no arraste.** Este é o bug mais importante: arrastar a linha do tempo com o mouse não pode selecionar anos, meses nem rótulos. Aplique as três medidas da seção 5 do README e teste no Chrome, Safari e Firefox.
2. **Atmosfera procedural.** Camada de fundo WebGL no mesmo renderer, desenhada antes do núcleo, multiplicada por `reveal`, com o culling de 8 nebulosas no desktop, 5 no mobile e 3 galáxias. A geração tem de ser determinística: mesma lista de publicações, mesmo céu. Uma publicação nova recompõe o céu sem intervenção manual.
3. **Anos gigantes** em camada DOM com parallax de 0.75.
4. **Linha do tempo por mês** (4.6 px/dia, marcadores mensais, destaque nos meses com publicação, eixo mais suave).
5. **Estrelas 2× maiores** com rótulo sempre visível (título curto + data) e o novo posicionamento do painel.
6. **Navegação:** velocidades novas, item `← INÍCIO` e toque em dois tempos no mobile.
7. **Núcleo:** troque a esfera interna escura pelo brilho interno.
8. **Performance:** fundo em meia resolução no mobile e em GPUs lentas, tempo do shader a 30% com movimento reduzido, fallback sem WebGL.

### Regras

- Nenhum elemento de atmosfera pode competir com as estrelas das publicações em brilho ou contraste.
- Nada de posições desenhadas à mão: tudo vem da semente.
- Mantenha a acessibilidade: cada estrela continua um `<button>` com `aria-label`; os rótulos visíveis são `aria-hidden`, porque repetem o label; foco por teclado intacto.
- Meça antes e depois com o painel de performance do navegador. O alvo é 60 fps em desktop médio e pelo menos 45 fps num celular intermediário.
- Pare ao fim de cada entrega, diga o que testar e espere a minha revisão.

Comece pela entrega 1.
