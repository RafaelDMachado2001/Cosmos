import { charCount } from './measure';
import { DIRECTIVE_RE, closest, hasOddQuotes, sortedErrors } from './parseText';
import type { SourceLine } from './parseText';
import type { DiagramError, DiagramParseResult, SpectrumLane, SpectrumZone } from './types';

export const SPECTRUM_LIMITS = {
  minZones: 2,
  zones: 5,
  minLanes: 2,
  lanes: 6,
  label: 28,
  field: 80,
  axis: 40,
} as const;

const RANGE_LINE_RE = /^(zone|lane)\s+"([^"]*)"\s+(\d+)\s*-\s*(\d+)$/;
const DIRECTIVES = ['title', 'axis', 'taste', 'next'] as const;

interface ZoneDraft extends Omit<SpectrumZone, 'taste' | 'next'> {
  taste: string | null;
  next: string | null;
}

export function parseSpectrum(
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
  let axis: { readonly from: string; readonly to: string } | null = null;
  const zones: ZoneDraft[] = [];
  const lanes: SpectrumLane[] = [];
  const seen = new Map<string, number>();

  const claim = (key: string, line: number, what: string): boolean => {
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      fail(line, `${what} repetido; já declarado na linha ${String(earlier)}`);
      return false;
    }
    seen.set(key, line);
    return true;
  };

  const readRange = (line: number, kind: string, label: string, from: number, to: number): void => {
    if (label.trim() === '') fail(line, `${kind} sem nome`);
    checkLength(line, label, SPECTRUM_LIMITS.label, 'nome');
    if (from >= to || to > 100) fail(line, `faixa ${String(from)}-${String(to)} inválida; use início menor que fim, até 100`);
    if (!claim(`${kind}:${label}`, line, `${kind} "${label}"`)) return;
    if (kind === 'zone') zones.push({ label, from, to, taste: null, next: null, line });
    else lanes.push({ label, from, to, line });
  };

  const readDirective = (line: number, name: string, value: string): void => {
    const directive = DIRECTIVES.find((candidate) => candidate === name);
    if (directive === undefined) {
      const hint = closest(name, DIRECTIVES);
      fail(line, `diretiva desconhecida "${name}". ${hint === null ? 'Use title, axis, taste ou next' : `Use "${hint}"`}`);
      return;
    }
    if (value === '') {
      fail(line, `"${directive}" sem texto`);
      return;
    }
    if (directive === 'title') {
      if (claim('title', line, '"title"')) title = value;
      return;
    }
    if (directive === 'axis') {
      const [from, to, ...rest] = value.split('->').map((part) => part.trim());
      if (!claim('axis', line, '"axis"')) return;
      if (from === undefined || to === undefined || from === '' || to === '' || rest.length > 0) {
        fail(line, 'eixo incompleto. Use: axis: início -> fim');
        return;
      }
      checkLength(line, from, SPECTRUM_LIMITS.axis, 'eixo');
      checkLength(line, to, SPECTRUM_LIMITS.axis, 'eixo');
      axis = { from, to };
      return;
    }
    const zone = zones.at(-1);
    if (zone === undefined) {
      fail(line, `"${directive}" fora de uma zona. Declare antes: zone "Nome" 0-50`);
      return;
    }
    if (!claim(`${zone.label}:${directive}`, line, `"${directive}"`)) return;
    checkLength(line, value, SPECTRUM_LIMITS.field, `"${directive}"`);
    zone[directive] = value;
  };

  for (const { number, text } of body) {
    if (hasOddQuotes(text)) {
      fail(number, 'aspas sem fechar');
      continue;
    }
    const range = RANGE_LINE_RE.exec(text);
    const directive = DIRECTIVE_RE.exec(text);
    if (range !== null) readRange(number, range[1] ?? '', range[2] ?? '', Number(range[3]), Number(range[4]));
    else if (directive !== null) readDirective(number, directive[1] ?? '', directive[2] ?? '');
    else fail(number, 'linha inválida. Use: zone "Nome" 0-50 ou lane "Nome" 0-50');
  }

  if (errors.length === 0) {
    if (zones.length < SPECTRUM_LIMITS.minZones || zones.length > SPECTRUM_LIMITS.zones) {
      fail(headerLine, `o espectro tem ${String(zones.length)} zonas; use de ${String(SPECTRUM_LIMITS.minZones)} a ${String(SPECTRUM_LIMITS.zones)}`);
    }
    if (lanes.length < SPECTRUM_LIMITS.minLanes || lanes.length > SPECTRUM_LIMITS.lanes) {
      fail(headerLine, `o espectro tem ${String(lanes.length)} faixas; use de ${String(SPECTRUM_LIMITS.minLanes)} a ${String(SPECTRUM_LIMITS.lanes)}`);
    }
    let expected = 0;
    for (const zone of zones) {
      if (zone.from !== expected) {
        fail(zone.line, `a zona "${zone.label}" começa em ${String(zone.from)}; deveria começar em ${String(expected)}`);
      }
      expected = zone.to;
    }
    const last = zones.at(-1);
    if (last !== undefined && last.to !== 100) {
      fail(last.line, `as zonas terminam em ${String(last.to)}; a última precisa chegar a 100`);
    }
  }

  if (errors.length > 0) return { ok: false, errors: sortedErrors(errors) };
  return { ok: true, diagram: { kind: 'spectrum', id, title, axis, zones, lanes } };
}
