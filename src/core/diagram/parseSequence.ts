import { charCount } from './measure';
import { DIRECTIVE_RE, ID_RE, NODE_RE, closest, hasOddQuotes, sortedErrors } from './parseText';
import type { SourceLine } from './parseText';
import type { DiagramError, DiagramParseResult, SequenceMessage, SequenceParticipant } from './types';

export const SEQUENCE_LIMITS = {
  minParticipants: 2,
  participants: 5,
  messages: 20,
  participantLabel: 28,
  participantSub: 24,
  messageLabel: 28,
} as const;

const MESSAGE_RE = /^(\S+?)\s*(-->|->)\s*(\S+?)\s*(?::\s*(.*))?$/;

export function parseSequence(
  id: string,
  body: readonly SourceLine[],
  headerLine: number,
  headerErrors: readonly DiagramError[],
): DiagramParseResult {
  const errors = [...headerErrors];
  const fail = (line: number, message: string): void => {
    errors.push({ line, message });
  };
  const checkLength = (line: number, text: string, max: number, what: string): void => {
    const length = charCount(text);
    if (length > max) fail(line, `${what} com ${String(length)} caracteres; o máximo é ${String(max)}`);
  };

  let title: string | null = null;
  let titleLine: number | null = null;
  const participants: SequenceParticipant[] = [];
  const messages: SequenceMessage[] = [];

  const readDirective = (line: number, name: string, value: string): void => {
    if (name !== 'title') {
      fail(line, `diretiva desconhecida "${name}". Use "title"`);
      return;
    }
    if (titleLine !== null) {
      fail(line, `"title" repetido; já declarado na linha ${String(titleLine)}`);
      return;
    }
    titleLine = line;
    if (value === '') fail(line, '"title" sem texto');
    else title = value;
  };

  const readMessage = (line: number, text: string): void => {
    const match = MESSAGE_RE.exec(text);
    const from = match?.[1];
    const to = match?.[3];
    if (match === null || from === undefined || to === undefined) {
      fail(line, 'mensagem incompleta. Use: de -> para : texto');
      return;
    }
    const reply = match[2] === '-->';
    const label = match[4] === undefined || match[4] === '' ? null : match[4];
    if (label !== null) checkLength(line, label, SEQUENCE_LIMITS.messageLabel, 'mensagem');
    if (reply && from === to) fail(line, `resposta de "${from}" para ele mesmo; use ->`);
    if (messages.length === SEQUENCE_LIMITS.messages) {
      fail(line, `mais de ${String(SEQUENCE_LIMITS.messages)} mensagens; o máximo é ${String(SEQUENCE_LIMITS.messages)}`);
    }
    messages.push({ from, to, label, reply, line });
  };

  const readParticipant = (line: number, text: string): void => {
    const match = NODE_RE.exec(text);
    if (match === null) {
      const word = text.split(/\s+/)[0] ?? text;
      fail(line, `o rótulo de "${word}" precisa estar entre aspas: ${word} "Rótulo"`);
      return;
    }
    const participantId = match[1] ?? '';
    const label = match[2] ?? '';
    const sub = match[3] === undefined || match[3].trim() === '' ? null : match[3].trim();
    if (!ID_RE.test(participantId)) {
      fail(line, `id "${participantId}" inválido; use minúsculas, números e hífen, começando por letra`);
    }
    if (label.trim() === '') fail(line, `o rótulo de "${participantId}" está vazio`);
    checkLength(line, label, SEQUENCE_LIMITS.participantLabel, 'rótulo');
    if (sub !== null) checkLength(line, sub, SEQUENCE_LIMITS.participantSub, 'subtítulo');
    const earlier = participants.find((participant) => participant.id === participantId);
    if (earlier !== undefined) {
      fail(line, `id "${participantId}" repetido; já declarado na linha ${String(earlier.line)}`);
      return;
    }
    if (participants.length === SEQUENCE_LIMITS.participants) {
      fail(line, `mais de ${String(SEQUENCE_LIMITS.participants)} participantes; o máximo é ${String(SEQUENCE_LIMITS.participants)}`);
    }
    participants.push({ id: participantId, label, sub, line });
  };

  for (const { number, text } of body) {
    if (hasOddQuotes(text)) {
      fail(number, 'aspas sem fechar');
      continue;
    }
    const directive = DIRECTIVE_RE.exec(text);
    if (directive !== null) readDirective(number, directive[1] ?? '', directive[2] ?? '');
    else if (text.includes('->')) readMessage(number, text);
    else readParticipant(number, text);
  }

  const known = participants.map((participant) => participant.id);
  for (const message of messages) {
    for (const end of new Set([message.from, message.to])) {
      if (known.includes(end)) continue;
      const hint = closest(end, known);
      fail(message.line, `"${end}" não foi declarado.${hint === null ? '' : ` Você quis dizer "${hint}"?`}`);
    }
  }

  if (errors.length === 0 && participants.length < SEQUENCE_LIMITS.minParticipants) {
    fail(headerLine, `a sequência precisa de ao menos ${String(SEQUENCE_LIMITS.minParticipants)} participantes`);
  }
  if (errors.length === 0 && messages.length === 0) {
    fail(headerLine, 'a sequência não tem mensagens. Use: de -> para : texto');
  }

  if (errors.length > 0) return { ok: false, errors: sortedErrors(errors) };
  return { ok: true, diagram: { kind: 'sequence', id, title, participants, messages } };
}
