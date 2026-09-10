# RDM Labs · Cosmos

Experiência web onde publicações — artigos técnicos, estudos, projetos e registros de rotina —
aparecem como uma **constelação temporal** navegável, com um núcleo 3D como portal de entrada.

A especificação de design completa está em `design_handoff_rdm_cosmos/README.md` (cores,
tipografia, medidas, curvas de animação e comportamento de cada tela). O protótipo de referência
está em `design_handoff_rdm_cosmos/prototype/RDM Cosmos.dc.html`.

## Stack

React 18 · TypeScript · Vite · Three.js (puro, sem react-three-fiber) · CSS Modules sobre tokens.
Sem biblioteca de animação: interpolação exponencial (`damp`) e keyframes CSS.
Backend Laravel 11 + PostgreSQL 16 previsto, ainda não implementado.

## Rodando

Todo o desenvolvimento acontece em Docker.

```sh
cp .env.example .env      # ajuste DOCKER_UID/DOCKER_GID com `id -u` e `id -g`
docker compose up node    # dev server em http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `docker compose up node` | Vite com HMR (uso diário) |
| `docker compose up` | Vite + build de produção servido pelo Nginx em `:8080` |
| `docker compose --profile backend up` | Acrescenta Laravel e Postgres (ainda vazios) |
| `docker compose run --rm node npm run check` | typecheck + lint + testes |
| `docker compose run --rm node npm run test:watch` | testes em watch |

> O Node do host não é usado. Rodar `npm run` direto na máquina pode falhar por diferença de
> versão e por binários de plataforma (`esbuild`, `rollup`) — sempre via `docker compose run`.

## Arquitetura

- **`src/core/`** — TypeScript puro, sem DOM, sem React, sem Three. Posicionamento temporal,
  coeficientes de movimento, máquina de estados da navegação e filtros. É onde mora quase toda a
  suíte de testes.
- **`src/three/`** — a cena WebGL numa classe própria, com o rAF fora do React.
- **`src/components/`** — um diretório por componente, com o CSS Module ao lado.
- **`src/styles/tokens.css`** — fonte única de verdade das cores. A cena 3D lê estes mesmos
  tokens via `getComputedStyle`, para que CSS e shader nunca divirjam.
- **`src/i18n/`** — `pt.ts` é a fonte de verdade e `en.ts` é tipado contra ele: uma chave
  faltando quebra o typecheck em vez de renderizar vazio.

**Regra que governa o código:** nada que mude por frame passa pelo React. `enter`, `pan` e `zoom`
são refs mutáveis lidos por um único `requestAnimationFrame`, que escreve direto em
`style.transform` e nos uniforms. O React só reage a estado discreto.
