/**
 * Gerador de acervo sintético para teste de carga.
 *
 * O acervo real tem 14 publicações, o que não exercita nem o passe de
 * espaçamento nem a virtualização. Este gerador existe para provar que os dois
 * funcionam com centenas de itens, e fica atrás de uma flag de dev — nunca vai
 * para produção.
 */

import { mulberry32 } from '../core/random';
import { CATEGORIES } from '../core/types';
import type { Publication } from '../core/types';

export interface SyntheticOptions {
  readonly count: number;
  /** Mesma semente, mesmo acervo: uma falha de layout é reproduzível. */
  readonly seed?: number;
  readonly startISO?: string;
  readonly spanDays?: number;
}

const TOPICS_PT = [
  'cache distribuído',
  'particionamento de tabelas',
  'testes de contrato',
  'migração de esquema',
  'orçamento de performance',
  'filas idempotentes',
  'observabilidade de filas',
  'tipos no limite do sistema',
];

const TOPICS_EN = [
  'distributed cache',
  'table partitioning',
  'contract testing',
  'schema migration',
  'performance budget',
  'idempotent queues',
  'queue observability',
  'types at the boundary',
];

export function makeSyntheticPublications(options: SyntheticOptions): readonly Publication[] {
  const random = mulberry32(options.seed ?? 1);
  const start = Date.parse(`${options.startISO ?? '2019-01-01'}T00:00:00.000Z`);
  const spanDays = options.spanDays ?? 2600;

  return Array.from({ length: options.count }, (_, index) => {
    const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)] ?? 'artigo';
    const topicIndex = Math.floor(random() * TOPICS_PT.length);
    const topicPt = TOPICS_PT[topicIndex] ?? 'assunto';
    const topicEn = TOPICS_EN[topicIndex] ?? 'topic';
    const offsetDays = Math.floor(random() * spanDays);
    const offsetMinutes = Math.floor(random() * 1440);

    return {
      // Prefixo próprio: nunca colide com um slug real.
      slug: `sintetica-${index}`,
      publishedAt: new Date(start + offsetDays * 86400000 + offsetMinutes * 60000).toISOString(),
      category,
      content: {
        pt: {
          title: `Nota sintética ${index}: ${topicPt}`,
          summary: `Item gerado para teste de carga da constelação, sobre ${topicPt}.`,
          body: [`Conteúdo sintético número ${index}. Não é publicação real.`],
        },
        en: {
          title: `Synthetic note ${index}: ${topicEn}`,
          summary: `Generated item for constellation load testing, about ${topicEn}.`,
          body: [`Synthetic content number ${index}. Not a real publication.`],
        },
      },
    };
  });
}
