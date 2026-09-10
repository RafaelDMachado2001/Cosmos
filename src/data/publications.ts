/**
 * Acervo semente.
 *
 * São as 14 publicações do protótipo. Treze são fictícias e existem para
 * exercitar as quatro categorias e a distribuição temporal de 2024 a 2026 —
 * substituir por conteúdo real. A décima quarta é real e está marcada abaixo.
 *
 * Os slugs são ASCII de propósito: é o que garante que o FNV-1a sobre bytes
 * UTF-8 e sobre code units UTF-16 coincidam, protegendo a paridade das
 * posições quando o backend em PHP assumir o cálculo.
 */

import type { Publication } from '../core/types';

/** A única publicação real do acervo semente. */
export const REAL_PUBLICATION_SLUG = 'arquitetura-e-orquestracao-de-llms';

/**
 * Corpo de demonstração, igual ao do protótipo. Cada publicação recebe um
 * parágrafo de abertura próprio antes destes, para que a vista de leitura não
 * fique idêntica entre itens enquanto o conteúdo real não chega.
 */
const DEMO_BODY = {
  pt: [
    'Na implementação final o corpo do artigo vem do PostgreSQL em HTML semântico, renderizado no servidor para que os mecanismos de busca leiam o texto completo sem depender da camada 3D.',
    'A página interna abandona os efeitos da constelação e prioriza leitura: medida de linha entre 60 e 72 caracteres, entrelinha de 1.78 e contraste acima de 4.5:1. A estrela de origem continua indicada no rodapé para que o leitor saiba onde está na linha do tempo.',
    'Ao fechar, a câmera retorna exatamente ao ponto de onde saiu, sem recarregar a constelação.',
  ],
  en: [
    'In the final build the article body comes from PostgreSQL as semantic HTML, server-rendered so crawlers read the full text without depending on the 3D layer.',
    'The article view drops the constellation effects and prioritises reading: 60 to 72 character measure, 1.78 line height, contrast above 4.5:1. The origin star stays noted in the footer so the reader keeps their place on the timeline.',
    'On close, the camera returns to the exact point it left from, with no constellation reload.',
  ],
} as const;

interface SeedInput {
  readonly slug: string;
  readonly date: string;
  readonly category: Publication['category'];
  readonly featured?: boolean;
  readonly pt: { readonly title: string; readonly summary: string; readonly opening: string };
  readonly en: { readonly title: string; readonly summary: string; readonly opening: string };
}

function seed(input: SeedInput): Publication {
  return {
    slug: input.slug,
    publishedAt: `${input.date}T12:00:00.000Z`,
    category: input.category,
    ...(input.featured === undefined ? {} : { featured: input.featured }),
    content: {
      pt: {
        title: input.pt.title,
        summary: input.pt.summary,
        body: [input.pt.opening, ...DEMO_BODY.pt],
      },
      en: {
        title: input.en.title,
        summary: input.en.summary,
        body: [input.en.opening, ...DEMO_BODY.en],
      },
    },
  };
}

export const PUBLICATIONS: readonly Publication[] = [
  seed({
    slug: 'fundamentos-de-indices-no-postgresql',
    date: '2024-02-14',
    category: 'estudo',
    pt: {
      title: 'Fundamentos de índices no PostgreSQL',
      summary: 'Quando um índice ajuda, quando ele atrapalha e como ler um EXPLAIN sem adivinhar.',
      opening:
        'Índice não é enfeite de tabela grande: é uma estrutura que o planejador pode escolher ignorar. Entender quando ele decide isso vale mais do que decorar tipos de índice.',
    },
    en: {
      title: 'PostgreSQL index fundamentals',
      summary: 'When an index helps, when it hurts, and how to read an EXPLAIN without guessing.',
      opening:
        'An index is not decoration on a large table: it is a structure the planner may choose to ignore. Understanding when it makes that call is worth more than memorising index types.',
    },
  }),
  seed({
    slug: 'n-mais-1-o-custo-invisivel-do-eloquent',
    date: '2024-05-02',
    category: 'artigo',
    pt: {
      title: 'N+1: o custo invisível do Eloquent',
      summary:
        'Como consultas aninhadas derrubam a performance de telas simples e o que fazer a respeito.',
      opening:
        'O N+1 raramente aparece em desenvolvimento, onde a tabela tem trinta linhas. Ele aparece em produção, onde tem trezentas mil, e sempre na tela que o cliente mais usa.',
    },
    en: {
      title: 'N+1: the invisible cost of Eloquent',
      summary: 'How nested queries sink simple screens, and what to do about it.',
      opening:
        'N+1 rarely shows up in development, where the table holds thirty rows. It shows up in production, where it holds three hundred thousand, and always on the screen the client uses most.',
    },
  }),
  seed({
    slug: 'dashboard-de-logistica-em-tempo-real',
    date: '2024-08-20',
    category: 'projeto',
    pt: {
      title: 'Dashboard de logística em tempo real',
      summary:
        'Painel operacional com websockets, filas e um modelo de dados que aguenta pico de carga.',
      opening:
        'Painel operacional não é relatório com auto-refresh. O que se pede dele é latência baixa e consistência suficiente para alguém tomar decisão olhando a tela.',
    },
    en: {
      title: 'Real-time logistics dashboard',
      summary: 'Operations panel with websockets, queues and a data model built for peak load.',
      opening:
        'An operations panel is not a report on auto-refresh. What it is asked for is low latency and enough consistency for someone to make a call while looking at the screen.',
    },
  }),
  seed({
    slug: 'como-organizo-minha-semana-de-codigo',
    date: '2024-11-08',
    category: 'rotina',
    pt: {
      title: 'Como organizo minha semana de código',
      summary: 'Blocos de foco, revisão e estudo. O que sobreviveu depois de um ano tentando.',
      opening:
        'Quase todo método de produtividade que tentei morreu na terceira semana. Sobrou pouca coisa, e é justamente a parte chata que sobreviveu.',
    },
    en: {
      title: 'How I organise a week of code',
      summary: 'Focus, review and study blocks. What survived after a year of trying.',
      opening:
        'Almost every productivity method I tried died in week three. Little survived, and what did is precisely the boring part.',
    },
  }),
  seed({
    slug: 'filas-e-jobs-assincronos-no-laravel',
    date: '2025-01-16',
    category: 'estudo',
    pt: {
      title: 'Filas e jobs assíncronos no Laravel',
      summary: 'Idempotência, retentativas e o que acontece quando o worker morre no meio.',
      opening:
        'A pergunta que separa uma fila que funciona de uma que dá dor de cabeça não é como enfileirar, é o que acontece na segunda vez que o mesmo job roda.',
    },
    en: {
      title: 'Queues and async jobs in Laravel',
      summary: 'Idempotency, retries, and what happens when the worker dies halfway.',
      opening:
        'The question that separates a queue that works from one that hurts is not how to enqueue, it is what happens the second time the same job runs.',
    },
  }),
  seed({
    slug: 'modelagem-de-dados-para-sistemas-legados',
    date: '2025-04-03',
    category: 'artigo',
    pt: {
      title: 'Modelagem de dados para sistemas legados',
      summary:
        'Migrar sem parar o negócio: tabelas de transição, dupla escrita e cortes seguros.',
      opening:
        'Migração de esquema em sistema legado não é um evento, é um período. O modelo antigo e o novo convivem por semanas, e o projeto precisa ser desenhado para essa convivência.',
    },
    en: {
      title: 'Data modelling for legacy systems',
      summary: 'Migrating without stopping the business: transition tables, dual writes, safe cutovers.',
      opening:
        'A schema migration on a legacy system is not an event, it is a period. Old and new models coexist for weeks, and the design has to account for that coexistence.',
    },
  }),
  seed({
    slug: 'api-de-faturamento-multi-tenant',
    date: '2025-06-27',
    category: 'projeto',
    pt: {
      title: 'API de faturamento multi-tenant',
      summary: 'Isolamento por tenant, auditoria de cada evento e conciliação que fecha no centavo.',
      opening:
        'Faturamento é o subsistema em que um erro de arredondamento vira uma ligação do cliente. Auditoria não é requisito não-funcional aqui: é o produto.',
    },
    en: {
      title: 'Multi-tenant billing API',
      summary: 'Tenant isolation, an audit trail per event, and reconciliation down to the cent.',
      opening:
        'Billing is the subsystem where a rounding error becomes a phone call. An audit trail is not a non-functional requirement here: it is the product.',
    },
  }),
  seed({
    slug: 'code-review-sem-atrito',
    date: '2025-09-12',
    category: 'rotina',
    pt: {
      title: 'Code review sem atrito',
      summary: 'Comentar o código, não a pessoa. Regras curtas que reduziram o tempo de merge.',
      opening:
        'O tempo que uma PR passa aberta diz mais sobre a cultura do time do que sobre a complexidade do código. Reduzi o meu com três regras curtas.',
    },
    en: {
      title: 'Code review without friction',
      summary: 'Review the code, not the person. Short rules that cut our merge time.',
      opening:
        'How long a PR stays open says more about a team culture than about code complexity. I cut mine with three short rules.',
    },
  }),
  seed({
    slug: 'react-server-components-na-pratica',
    date: '2025-11-21',
    category: 'estudo',
    pt: {
      title: 'React Server Components na prática',
      summary: 'O que muda no fluxo de dados e onde o ganho real aparece em telas pesadas.',
      opening:
        'A promessa é menos JavaScript no cliente. O ganho real aparece antes disso, na hora em que se para de inventar endpoints só para alimentar um componente.',
    },
    en: {
      title: 'React Server Components in practice',
      summary: 'What changes in the data flow, and where the real gain shows up.',
      opening:
        'The promise is less JavaScript on the client. The real gain shows up earlier, the moment you stop inventing endpoints just to feed a component.',
    },
  }),
  seed({
    slug: 'rdm-labs-identidade-e-portfolio',
    date: '2026-01-09',
    category: 'projeto',
    pt: {
      title: 'RDM Labs: identidade e portfólio',
      summary: 'Do blob em GLSL ao sistema tipográfico. Um portfólio que explica como eu penso.',
      opening:
        'Um portfólio de desenvolvedor costuma listar tecnologias. Quis que o meu mostrasse decisões: por que aquela cor, por que aquela curva de animação, por que aquele recorte.',
    },
    en: {
      title: 'RDM Labs: identity and portfolio',
      summary: 'From the GLSL blob to the type system. A portfolio that shows how I think.',
      opening:
        'A developer portfolio usually lists technologies. I wanted mine to show decisions: why that colour, why that easing curve, why that scope.',
    },
  }),
  seed({
    slug: 'observabilidade-com-opentelemetry',
    date: '2026-03-18',
    category: 'artigo',
    pt: {
      title: 'Observabilidade com OpenTelemetry',
      summary: 'Traces, métricas e logs correlacionados: achar a causa antes do cliente ligar.',
      opening:
        'Três sinais desconexos não são observabilidade, são três painéis. O que muda o jogo é a correlação: sair de um trace lento para o log exato daquela requisição.',
    },
    en: {
      title: 'Observability with OpenTelemetry',
      summary: 'Correlated traces, metrics and logs: find the cause before the client calls.',
      opening:
        'Three disconnected signals are not observability, they are three dashboards. Correlation is what changes the game: jumping from a slow trace to the exact log line for that request.',
    },
  }),
  seed({
    slug: 'shaders-glsl-para-interfaces',
    date: '2026-05-30',
    category: 'estudo',
    pt: {
      title: 'Shaders GLSL para interfaces',
      summary: 'Ruído, fresnel e deformação de malha aplicados a produtos, não a demos.',
      opening:
        'Shader em produto tem restrições que demo não tem: precisa rodar em notebook integrado, respeitar movimento reduzido e não roubar a atenção do conteúdo.',
    },
    en: {
      title: 'GLSL shaders for interfaces',
      summary: 'Noise, fresnel and mesh displacement applied to products, not demos.',
      opening:
        'A shader in a product has constraints a demo does not: it must run on integrated graphics, respect reduced motion, and never steal attention from the content.',
    },
  }),
  seed({
    slug: 'o-que-aprendi-em-5-anos-de-legado',
    date: '2026-07-15',
    category: 'rotina',
    pt: {
      title: 'O que aprendi em 5 anos de legado',
      summary: 'Não subestimar o usuário, e nunca confiar em uma migração sem plano de volta.',
      opening:
        'Sistema legado é sistema que funciona. Essa frase parece óbvia até a primeira vez que se reescreve algo "mal feito" e se descobre para que aquilo servia.',
    },
    en: {
      title: 'Five years of legacy code',
      summary: 'Never underestimate the user, and never trust a migration without a rollback.',
      opening:
        'A legacy system is a system that works. That sounds obvious until the first time you rewrite something "badly done" and find out what it was for.',
    },
  }),
  // --- A única publicação real do acervo -----------------------------------
  seed({
    slug: REAL_PUBLICATION_SLUG,
    date: '2026-09-09',
    category: 'artigo',
    featured: true,
    pt: {
      title: 'Arquitetura e Orquestração de LLMs',
      summary:
        'Como estruturar agentes, contexto e ferramentas em um sistema que precisa ser previsível.',
      opening:
        'A parte difícil de construir com modelos de linguagem não é a chamada à API: é desenhar um sistema cujo comportamento se possa prever, testar e explicar para quem depende dele.',
    },
    en: {
      title: 'LLM architecture and orchestration',
      summary: 'Structuring agents, context and tools into a system that has to stay predictable.',
      opening:
        'The hard part of building with language models is not the API call: it is designing a system whose behaviour you can predict, test and explain to the people who depend on it.',
    },
  }),
];
