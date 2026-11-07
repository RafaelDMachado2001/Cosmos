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
  {
    id: 'espectro',
    label: 'Espectro',
    source: `spectrum espectro
title: Título do espectro
axis: início -> fim

zone "Pouco" 0-40
  taste: O que se percebe aqui
  next: O que ajustar
zone "Muito" 40-100
  taste: O que se percebe aqui
  next: O que ajustar

lane "Primeira faixa" 0-60
lane "Segunda faixa" 30-100`,
  },
  {
    id: 'sequencia',
    label: 'Sequência',
    source: `sequence sequencia
title: Título da sequência

cliente  "Cliente"  / quem pede
servidor "Servidor" / quem responde

cliente  -> servidor : pedido
servidor -> servidor : processa
servidor --> cliente : resposta`,
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
c -> a : de novo                # volta: fecha um ciclo

state 502                       # cenário: vira uma aba
  title: Título do painel       # title, text e hint são opcionais
  text: O que aconteceu.
  hint: Por onde começar.        # para um # literal, use \\#
  path a b                      # caminho destacado, nó a nó
  b -> c broken                 # aresta: broken ou slow
  c down                        # nó: down ou slow`;

export const SPECTRUM_SYNTAX_EXAMPLE = `spectrum meu-espectro           # régua de 0 a 100
title: Legenda da figura         # opcional
axis: início -> fim              # opcional

zone "Pouco" 0-40                # zona: vira uma aba
  taste: O que se percebe.       # taste e next são opcionais
  next: O que ajustar.
zone "Muito" 40-100              # sem buracos, até 100

lane "Primeira" 0-60             # faixa: uma linha na régua
lane "Segunda" 30-100`;

export const SEQUENCE_SYNTAX_EXAMPLE = `sequence minha-sequencia         # mensagens na ordem do tempo
title: Legenda da figura          # opcional

a "Primeiro" / subtítulo          # participante: de 2 a 5
b "Segundo"

a -> b : pedido                   # mensagem
b -> b : processa                 # para si mesmo
b --> a : resposta                # resposta, tracejada`;
