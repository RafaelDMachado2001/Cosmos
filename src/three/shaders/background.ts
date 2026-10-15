/**
 * O céu de fundo do cosmos: estrelas em três profundidades, galáxias e
 * nebulosas. Portado quase literalmente do `BG_FRAG` do protótipo de
 * atmosfera — é a especificação exata do efeito.
 *
 * Uma passada de tela cheia, custo fixo por pixel. Estrelas por grade com
 * hash, sem buffers; galáxias e nebulosas chegam por arrays de tamanho fixo,
 * já filtradas por `cullSky`. As cores internas (lavanda, quente pálido, o
 * branco-violeta das galáxias) são do handoff e só existem aqui.
 *
 * `uOctaves` (3 ou 5) é o recuo de performance: GLSL ES 1.0 exige laço com
 * limite constante, então o laço vai até 5 e sai antes.
 */

export const MAX_NEBULAE = 8;
export const MAX_GALAXIES = 3;

export const BACKGROUND_VERTEX_SHADER = /* glsl */ `
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const BACKGROUND_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform float uDpr; uniform float uPan; uniform float uTime; uniform float uReveal; uniform float uMy;
uniform int uOctaves;
uniform vec4 uNeb[${MAX_NEBULAE}]; uniform vec3 uNebC[${MAX_NEBULAE}]; uniform int uNebN;
uniform vec4 uGal[${MAX_GALAXIES}]; uniform vec2 uGalB[${MAX_GALAXIES}]; uniform int uGalN;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { if (i >= uOctaves) break; v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
vec3 starLayer(vec2 p, float cell, float dens, float bright, float seed){
  vec2 g = floor(p / cell); vec2 f = fract(p / cell);
  float r = h21(g + seed); if (r > dens) return vec3(0.0);
  vec2 c = vec2(h21(g + seed + 3.1), h21(g + seed + 7.7)) * 0.8 + 0.1;
  float d = length((f - c) * cell);
  float tw = 0.7 + 0.3 * sin(uTime * (0.5 + r * 2.0) + r * 40.0);
  float core = smoothstep(1.4, 0.0, d);
  float halo = exp(-d * 0.55) * 0.18;
  vec3 col = mix(vec3(0.76, 0.73, 1.0), vec3(1.0, 0.86, 0.76), h21(g + seed + 1.3));
  return col * (core + halo) * bright * tw;
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 col = vec3(0.0);
  col += starLayer(px + vec2(uPan * 0.12, 0.0), 22.0, 0.09, 0.38, 11.0);
  col += starLayer(px + vec2(uPan * 0.30, 0.0), 44.0, 0.10, 0.62, 37.0);
  col += starLayer(px + vec2(uPan * 0.55, 0.0), 96.0, 0.13, 0.95, 71.0);

  vec2 gp = px + vec2(uPan * 0.3, 0.0);
  for (int i = 0; i < ${MAX_GALAXIES}; i++) { if (i >= uGalN) break;
    vec4 G = uGal[i]; vec2 d = gp - G.xy;
    float ca = cos(G.w), sa = sin(G.w); d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y); d.y /= uGalB[i].x;
    float r = length(d) / G.z; float th = atan(d.y, d.x);
    float arms = 0.5 + 0.5 * cos(2.0 * (th - 3.0 * log(r + 0.04)) + uTime * 0.03);
    float grain = 0.6 + 0.4 * vnoise(d * 0.25);
    float disk = exp(-r * 2.2) * pow(arms, 2.5) * grain;
    float core = exp(-r * 9.0);
    col += vec3(0.78, 0.72, 1.0) * (core * 0.95 + disk * 0.42) * uGalB[i].y;
  }

  vec3 neb = vec3(0.0);
  vec2 wp = px + vec2(uPan * 0.6, uMy * 10.0);
  for (int i = 0; i < ${MAX_NEBULAE}; i++) { if (i >= uNebN) break;
    vec4 nb = uNeb[i]; vec2 d = (wp - nb.xy) / vec2(nb.z * 1.6, nb.z);
    neb += uNebC[i] * exp(-dot(d, d) * 1.5) * nb.w;
  }
  // As três fbm só quando há nebulosa por perto: é a parte cara do quadro.
  if (max(neb.r, max(neb.g, neb.b)) > 0.002) {
    float n1 = fbm(wp * 0.0026 + vec2(uTime * 0.004, 0.0));
    float n2 = fbm(wp * 0.0072 + n1 * 1.6 - vec2(0.0, uTime * 0.006));
    float n3 = fbm(wp * 0.018 + n2 * 2.0);
    float cloud = smoothstep(0.44, 0.98, n1 * 0.55 + n2 * 0.65);
    float wisps = pow(smoothstep(0.45, 1.0, n2 * 0.5 + n3 * 0.6), 2.0);
    float lane = smoothstep(0.55, 0.75, n3) * 0.55;
    col += neb * (cloud * 0.36 + wisps * 0.24) * (1.0 - lane);
  }
  col *= uReveal;
  // Dithering de meio degrau: some com as faixas visíveis no degradê.
  col += (h21(gl_FragCoord.xy + fract(uTime * 7.0)) - 0.5) / 255.0;
  col = max(col, 0.0);
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;
