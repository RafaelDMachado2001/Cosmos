/** O que basta de um `pointerdown` — nativo ou sintético do React. */
interface PointerDownLike {
  readonly pointerType: string;
  readonly button: number;
  preventDefault(): void;
}

/**
 * Arrastar a linha do tempo com o mouse nunca pode selecionar texto.
 *
 * O `user-select: none` do CSS não basta sozinho: uma seleção que começou
 * fora da área (no hero, no header) continua crescendo por cima dela. Cancelar
 * o padrão do `pointerdown` corta isso na origem e não impede o `click` — só a
 * seleção e o foco por mouse. O foco por teclado continua intacto.
 *
 * Só o botão principal do mouse: o toque precisa do padrão para rolar e dar
 * zoom, e o botão do meio é o que abre a estrela em nova aba.
 */
export function suppressMouseSelection(event: PointerDownLike): void {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  event.preventDefault();
  const selection = document.getSelection();
  if (selection && selection.rangeCount > 0) selection.removeAllRanges();
}
