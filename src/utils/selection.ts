interface PointerDownLike {
  readonly pointerType: string;
  readonly button: number;
  preventDefault(): void;
}

export function suppressMouseSelection(event: PointerDownLike): void {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  event.preventDefault();
  const selection = document.getSelection();
  if (selection && selection.rangeCount > 0) selection.removeAllRanges();
}
