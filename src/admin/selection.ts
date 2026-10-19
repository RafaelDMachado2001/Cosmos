/**
 * A publicação aberta no Studio, no endereço (`?publication=<id>`).
 *
 * É o que deixa o painel do Filament abrir uma publicação direto no Studio e
 * o que faz recarregar a página voltar para a mesma publicação.
 */

const PARAM = 'publication';

export function selectedFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get(PARAM);
  if (raw === null || !/^[1-9][0-9]*$/.test(raw)) return null;
  return Number(raw);
}

export function searchForSelected(search: string, id: number | null): string {
  const params = new URLSearchParams(search);
  if (id === null) params.delete(PARAM);
  else params.set(PARAM, String(id));
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
