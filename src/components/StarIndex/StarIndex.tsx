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
 */
export function StarIndex({ items, label, hrefFor }: StarIndexProps) {
  return (
    <nav className="visually-hidden" aria-label={label}>
      <ol>
        {items.map((item) => (
          <li key={item.slug}>
            <a href={hrefFor(item.slug)}>{item.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
