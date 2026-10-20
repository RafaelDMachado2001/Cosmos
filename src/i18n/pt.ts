import { LOCALE_TAG } from '../core/types';

/**
 * Fonte de verdade do vocabulário. `en.ts` é tipado contra este objeto, então
 * uma chave faltando quebra o typecheck em vez de renderizar vazio.
 */
export const pt = {
  meta: {
    localeTag: LOCALE_TAG.pt,
    title: 'RDM Labs · Cosmos',
    description:
      'Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.',
  },
  hero: {
    kicker: 'RDM LABS / COSMOS',
    title: 'Entre no meu universo',
    subtitle:
      'Artigos, estudos, projetos e registros de rotina organizados como uma constelação temporal.',
    /** Nome acessível do botão de entrada: não é mais renderizado na tela. */
    scrollHint: 'Role para atravessar',
  },
  nav: {
    brand: 'RDM LABS',
    /** Volta à entrada pelo caminho da travessia. A seta é decorativa. */
    home: 'INÍCIO',
    cosmos: 'CONSTELAÇÃO',
    categories: 'CATEGORIAS',
    portfolio: 'PORTFÓLIO',
    /** Distingue este landmark dos outros `nav` da página. */
    primaryLabel: 'Navegação principal',
    skipToContent: 'Pular para o conteúdo',
    localeLabel: 'Idioma',
    /** O outro idioma, nomeado na língua dele. */
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
    /** No toque, o primeiro toque só mostra o painel. */
    tapHint: 'TOQUE DE NOVO PARA ABRIR',
    indexLabel: 'Todas as publicações',
  },
  reader: {
    back: 'VOLTAR À CONSTELAÇÃO',
    close: 'Fechar e voltar à constelação',
    /** O link do topo do painel; a seta é decorativa. */
    constellation: 'Constelação',
    inThisArticle: 'Neste artigo',
    /** Depois do número: `7 min de leitura`. */
    minutes: 'min de leitura',
    progress: 'Progresso da leitura',
    resume: 'Continuar de onde parou',
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
