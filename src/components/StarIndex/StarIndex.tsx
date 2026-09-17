import type { PublicationSummary } from '../../core/types';

export interface StarIndexProps {
  readonly items: readonly PublicationSummary[];
  readonly label: string;
  readonly hrefFor: (slug: string) => string;
}

/**
 * Lista completa das publicações, visualmente oculta e **nunca virtualizada**.
 *
 * É ela que carrega a semântica: leitores de tela e rastreadores recebem 100%
 * do acervo como âncoras reais, independentemente do que a camada decorativa
 * decida montar ou desmontar. Sem transform, sem gradiente e sem listener,
 * algumas centenas de âncoras não custam nada.
 *
 * Fora da ordem de Tab de propósito. As estrelas da constelação já são as
 * mesmas âncoras, para os mesmos destinos: deixar as duas listas focáveis dava
 * o dobro de paradas, e metade delas em elementos que ninguém vê. O rastreador
 * segue os `href` de qualquer modo, e no modo de leitura de um leitor de tela a
 * lista continua inteira — `tabindex="-1"` tira do Tab, não da árvore.
 */
export function StarIndex({ items, label, hrefFor }: StarIndexProps) {
  return (
    <nav className="visually-hidden" aria-label={label}>
      <ol>
        {items.map((item) => (
          <li key={item.slug}>
            <a href={hrefFor(item.slug)} tabIndex={-1}>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
