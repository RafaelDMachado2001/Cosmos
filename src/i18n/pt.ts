/**
 * Fonte de verdade do vocabulário. `en.ts` é tipado contra este objeto, então
 * uma chave faltando quebra o typecheck em vez de renderizar vazio.
 */
export const pt = {
  meta: {
    localeTag: 'pt-BR',
    title: 'RDM Labs · Cosmos',
    description:
      'Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.',
  },
  hero: {
    kicker: 'RDM LABS / COSMOS',
    title: 'Entre no meu universo',
    subtitle:
      'Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.',
    scrollHint: 'ROLE PARA ATRAVESSAR',
  },
  nav: {
    brand: 'RDM LABS',
    cosmos: 'CONSTELAÇÃO',
    categories: 'CATEGORIAS',
    portfolio: 'PORTFÓLIO',
    skipToContent: 'Pular para o conteúdo',
    localeLabel: 'Idioma',
  },
  search: {
    placeholder: 'buscar no cosmos…',
    label: 'Buscar no cosmos',
  },
  ruler: {
    past: 'PASSADO',
    now: 'HOJE',
    dragHint: 'ARRASTE OU ROLE',
    label: 'Percorrer a linha do tempo',
  },
  star: {
    openHint: 'CLIQUE PARA ABRIR',
    indexLabel: 'Todas as publicações',
  },
  reader: {
    back: 'VOLTAR À CONSTELAÇÃO',
    close: 'Fechar e voltar à constelação',
  },
  categories: {
    filterBy: 'FILTRAR POR CATEGORIA',
    all: 'Tudo',
    artigo: 'Artigo técnico',
    projeto: 'Projeto',
    estudo: 'Estudo',
    rotina: 'Rotina',
  },
  empty: {
    title: 'NENHUMA ESTRELA ENCONTRADA',
    subtitle: 'Ajuste a busca ou remova o filtro de categoria.',
  },
  error: {
    title: 'NÃO FOI POSSÍVEL CARREGAR O COSMOS',
    subtitle: 'Algo falhou ao buscar as publicações.',
    retry: 'TENTAR NOVAMENTE',
  },
};

export type Dictionary = typeof pt;
