# Pedido de design: o leitor com conta (D4)

O backend da etapa 2 está pronto e em produção: login com Google e GitHub, perfil, sair, exportar
os dados e apagar a conta. Falta a interface no site, e a regra do projeto é não inventar cor,
fonte, espaçamento ou componente fora de um handoff de design. Este documento é o que levar para o design.

## O que precisa existir

### 1. Entrar
- Um ponto de entrada no header do site, que hoje tem marca, navegação, busca e idioma. No hero,
  o header só mostra a marca e o idioma: decidir se o "Entrar" aparece lá também.
- A escolha do provedor: **Google** e **GitHub**. Cada um é um link de página inteira (o navegador
  sai para o provedor e volta), não um popup.
- A volta para onde a pessoa estava: se ela entrou lendo um artigo, volta para o artigo.

### 2. O leitor logado
- O que substitui o "Entrar": avatar (pode não existir: o GitHub nem sempre manda, e a conta
  apagada não tem), nome ou `@handle`.
- Um menu com: **Minha conta**, **Sair**.

### 3. Minha conta
Uma página (ou painel) com:
- **Perfil editável:** nome (até 80 caracteres), `@handle` e idioma (PT/EN).
  - O handle tem regra: minúsculo, letras, números e `_`, de 3 a 30 caracteres. Alguns são
    reservados (admin, api, cosmos...), e não pode ser o de outra pessoa. O erro vem da API por
    campo e precisa de lugar para aparecer junto do campo.
- **Contas ligadas:** quais provedores a pessoa usa (Google, GitHub, ou os dois).
- **Baixar meus dados:** um link que baixa um JSON.
- **Apagar minha conta:** uma ação destrutiva, com confirmação. Depois dela a pessoa sai e volta
  para o site anônima. É irreversível.

### 4. Mensagens de volta do login
A API devolve a pessoa com `?login=` quando não dá certo:
- `unverified`: o e-mail do provedor não está verificado (no GitHub, nenhum e-mail primário
  verificado). Precisa dizer o que fazer.
- `failed`: o provedor falhou ou a pessoa cancelou.

### 5. Privacidade e rodapé
- **Página de privacidade**, nos dois idiomas, gerada no build como as outras. O texto jurídico
  é do autor; o design define a forma (é uma página de leitura longa, parente do artigo).
- **Um rodapé**, que o site ainda não tem, com o link para ela. Decidir onde ele vive: a home é
  a constelação, que ocupa a tela inteira; o artigo tem fim de página.

## Estados que o design precisa cobrir
- **Carregando a sessão.** O HTML do site é o mesmo para todo mundo (vem do CDN), e a sessão só
  é conhecida depois de uma chamada à API, uma fração de segundo depois. Nesse intervalo, o
  header não pode mostrar "Entrar" para quem já entrou, nem mudar de tamanho quando a resposta
  chega.
- **Anônimo, logado, e erro da API** (a API fora do ar não pode quebrar a leitura: o site
  continua, só sem a conta).
- **Salvando, salvo e recusado**, no perfil.
- **Mobile.** O header atual tem regras próprias abaixo de 760px.

## Restrições que já existem
- **Os tokens são os do site** (`src/styles/tokens.css`) e o vocabulário vem de `src/i18n/pt.ts`
  e `en.ts`: todo texto novo precisa das duas versões.
- **Acessibilidade:** tudo por teclado, foco visível, os provedores como links reais, a
  confirmação de apagar como diálogo com foco preso.
- **Nada de cookie além da sessão e do CSRF**, então não há banner de consentimento.
- **Performance:** nada disso pode atrasar a constelação; a conta carrega depois da página.

## Fora deste pedido
Comentários, compartilhamento, notificações, perfil público de outras pessoas e gamificação. São
as etapas seguintes e vão ter o próprio pedido.

## O que a API já oferece

| Rota | Faz |
|---|---|
| `GET api.rdmlabs.com.br/auth/{google,github}/redirect?return=/caminho` | Começa o login |
| `GET /api/me` | Perfil, ou 204 sem sessão |
| `PATCH /api/me` | Nome, handle, idioma; 422 com erros por campo |
| `POST /auth/logout` | Sai |
| `GET /api/me/export` | O JSON dos dados |
| `DELETE /api/me` | Apaga a conta e sai |

No site, `src/core/session.ts` já tem os estados (`loading`, `anonymous`, `member`), o link de
login e a leitura do `?login=`, e `src/data/MemberSource.ts` já fala com a API. A interface é a
única parte que falta.
