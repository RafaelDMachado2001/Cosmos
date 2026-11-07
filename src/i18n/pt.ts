import { LOCALE_TAG } from '../core/types';

export const pt = {
  meta: {
    localeTag: LOCALE_TAG.pt,
    title: 'RDM Labs · Cosmos',
    description:
      'Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.',
  },
  hero: {
    kicker: 'RDM LABS / COSMOS',
    title: 'Bem-vindo ao meu Cosmos!',
    subtitle:
      'Este é o lugar onde guardo o que penso, estudo e construo. Puxe uma cadeira, olhe para cima e navegue pelas constelações.',
    scrollHint: 'Role para atravessar',
    skip: 'Ver publicações',
  },
  nav: {
    brand: 'RDM LABS',
    home: 'INÍCIO',
    categories: 'CATEGORIAS',
    primaryLabel: 'Navegação principal',
    skipToContent: 'Pular para o conteúdo',
    localeLabel: 'Idioma',
    otherLocale: 'ENGLISH',
    otherLocaleTag: 'en',
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
    tapHint: 'TOQUE DE NOVO PARA ABRIR',
    indexLabel: 'Todas as publicações',
  },
  reader: {
    back: 'VOLTAR À CONSTELAÇÃO',
    close: 'Fechar e voltar à constelação',
    constellation: 'Constelação',
    inThisArticle: 'Neste artigo',
    minutes: 'min de leitura',
    progress: 'Progresso da leitura',
    resume: 'Continuar de onde parou',
    tags: 'Tags',
  },
  diagram: {
    to: 'para',
    via: 'via',
    when: 'quando',
    isolated: 'sem conexões',
    scenario: 'Cenário',
    route: 'Caminho',
    hint: 'Dica',
    broken: 'com falha',
    slow: 'lento',
    down: 'fora do ar',
    overview: 'Visão geral',
    scenarios: 'Cenários do diagrama',
  },
  categories: {
    filterBy: 'FILTRAR POR CATEGORIA',
    all: 'Tudo',
    artigo: 'Artigo técnico',
    projeto: 'Projeto',
    estudo: 'Estudo',
    rotina: 'Rotina',
  },
  loading: {
    title: 'MAPEANDO O COSMOS',
    subtitle: 'Buscando as publicações.',
  },
  empty: {
    title: 'NENHUMA ESTRELA ENCONTRADA',
    subtitle: 'Ajuste a busca ou remova o filtro de categoria.',
  },
  notFound: {
    title: 'ESTA ESTRELA NÃO EXISTE',
    subtitle: 'O endereço não corresponde a nenhuma publicação do acervo.',
    back: 'VER A CONSTELAÇÃO',
  },
  error: {
    title: 'NÃO FOI POSSÍVEL CARREGAR O COSMOS',
    subtitle: 'Algo falhou ao buscar as publicações.',
    retry: 'TENTAR NOVAMENTE',
  },
};

export type Dictionary = typeof pt;
