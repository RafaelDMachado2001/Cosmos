import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import satori from 'satori';

import { monthYearLabel } from '../core/format';
import { OG_SIZE, parseTokens } from '../core/og';
import type { OgCard } from '../core/og';
import tokensCss from '../styles/tokens.css?raw';

const require = createRequire(import.meta.url);
const TOKENS = parseTokens(tokensCss);

function token(name: string): string {
  const value = TOKENS[name];
  if (value === undefined) throw new Error(`--${name} não está em tokens.css`);
  return value;
}

type Font = Parameters<typeof satori>[1]['fonts'][number];

let ready: Promise<readonly Font[]> | null = null;

function prepare(): Promise<readonly Font[]> {
  ready ??= (async () => {
    await initWasm(readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
    const font = async (file: string, name: string, weight: 300 | 400 | 500): Promise<Font> => ({
      name,
      weight,
      style: 'normal',
      data: await readFile(require.resolve(file)),
    });
    return Promise.all([
      font('@fontsource/roboto/files/roboto-latin-300-normal.woff', 'Roboto', 300),
      font('@fontsource/roboto/files/roboto-latin-400-normal.woff', 'Roboto', 400),
      font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff', 'JetBrains Mono', 500),
    ]);
  })();
  return ready;
}

const STAR_X = 960;
const STAR_Y = 270;
const STAR = 180;
const AURA = 840;

function cardElement(card: OgCard) {
  const accent = token(card.category === undefined ? 'color-accent' : `color-cat-${card.category}`);
  const date = card.date === undefined ? null : monthYearLabel(Date.parse(card.date), card.locale);
  const titleSize = card.title.length > 48 ? 60 : 72;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: token('color-bg'),
        fontFamily: 'Roboto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: STAR_X - AURA / 2,
          top: STAR_Y - AURA / 2,
          width: AURA,
          height: AURA,
          borderRadius: 999,
          backgroundImage: `radial-gradient(circle, ${accent}33 0%, ${accent}0d 40%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: STAR_X - STAR / 2,
          top: STAR_Y - STAR / 2,
          width: STAR,
          height: STAR,
          borderRadius: 999,
          backgroundImage: `radial-gradient(circle at 40% 36%, #ffffff 0%, ${accent} 44%, ${accent}00 78%)`,
          boxShadow: `0 0 80px 16px ${accent}55`,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontFamily: 'JetBrains Mono',
          fontSize: 24,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: token('color-text-ui'),
        }}
      >
        {card.kicker}
      </div>

      <div
        style={{
          display: 'flex',
          maxWidth: 760,
          fontSize: titleSize,
          fontWeight: 300,
          lineHeight: 1.12,
          color: token('color-text-title'),
        }}
      >
        {card.title}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono',
          fontSize: 22,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: token('color-text-muted'),
          borderTop: `1px solid ${token('color-border-accent')}`,
          paddingTop: 28,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width={30} height={30} viewBox="0 0 32 32">
            <circle
              cx={16}
              cy={16}
              r={11}
              fill="none"
              stroke={token('color-text-ui')}
              strokeOpacity={0.55}
              strokeWidth={2.4}
            />
            <circle cx={16} cy={16} r={5} fill={token('color-text-primary')} />
            <circle cx={16} cy={5} r={4} fill={token('color-brand-cosmos')} />
          </svg>
          RDM Labs / Cosmos
        </span>
        {date === null ? null : <span>{date}</span>}
      </div>
    </div>
  );
}

export async function ogSvg(card: OgCard): Promise<string> {
  const fonts = await prepare();
  return satori(cardElement(card), {
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    fonts: [...fonts],
  });
}

export async function ogPng(card: OgCard): Promise<Buffer> {
  const svg = await ogSvg(card);
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng());
}
