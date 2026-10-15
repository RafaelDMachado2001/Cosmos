/**
 * Cópia de tela cheia: amplia o céu desenhado em meia resolução. A textura já
 * está em alfa pré-multiplicado, e o material também, então nada é recalculado.
 */

export const COPY_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const COPY_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tMap;
varying vec2 vUv;
void main(){ gl_FragColor = texture2D(tMap, vUv); }
`;
