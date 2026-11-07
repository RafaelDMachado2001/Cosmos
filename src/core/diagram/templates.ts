export interface DiagramTemplate {
  readonly id: string;
  readonly label: string;
  readonly source: string;
}

export const DIAGRAM_TEMPLATES: readonly DiagramTemplate[] = [
  {
    id: 'linear',
    label: 'Linear',
    source: `flow linear
title: Título do fluxo

inicio "Início"  / primeira etapa
meio   "Meio"    / etapa seguinte
fim    "Fim"     / resultado

inicio -> meio : passa para
meio   -> fim  : conclui`,
  },
  {
    id: 'ramificado',
    label: 'Ramificado',
    source: `flow ramificado
title: Título do fluxo

entrada "Entrada"  / ponto de partida
rapido  "Atalho"   / caminho curto
normal  "Processa" / caminho comum
saida   "Saída"    / resultado

entrada -> rapido : já existe?
entrada -> normal : senão
normal  -> saida  : conclui`,
  },
  {
    id: 'convergente',
    label: 'Convergente',
    source: `flow convergente
title: Título do fluxo

fonte-a "Origem A"  / primeira fonte
fonte-b "Origem B"  / segunda fonte
central "Central"   / reúne as duas
saida   "Saída"     / resultado

fonte-a -> central : envia
fonte-b -> central : envia
central -> saida   : entrega`,
  },
];

export const DIAGRAM_SYNTAX_EXAMPLE = `flow meu-fluxo                  # sempre a primeira linha
title: Legenda da figura        # opcional
direction: auto                 # auto, right ou down

a "Rótulo"  / subtítulo         # nó: id "Rótulo" / subtítulo
b "Destino"
c "Fim"

a -> b : rótulo | curto         # aresta: "curto" vale no celular
b -> c

state 502                       # cenário: vira uma aba
  title: Título do painel       # title, text e hint são opcionais
  text: O que aconteceu.
  hint: Por onde começar.        # para um # literal, use \\#
  path a b                      # caminho destacado, nó a nó
  b -> c broken                 # aresta: broken ou slow
  c down                        # nó: down ou slow`;
