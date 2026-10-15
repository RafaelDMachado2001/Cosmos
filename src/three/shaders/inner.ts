/**
 * O brilho dentro do núcleo: "fresnel invertido", mais forte no centro.
 *
 * Substitui a esfera opaca `#0a0714` que parecia um furo. Aditivo, com o
 * gradiente do handoff de atmosfera (`rgb(0.16,0.09,0.42)` → `rgb(0.70,0.58,1.0)`)
 * e intensidade `0.40 + 0.28·pulso`, acompanhando a energia da borda.
 */

export const INNER_VERTEX_SHADER = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const INNER_FRAGMENT_SHADER = /* glsl */ `
uniform float uO;
uniform float uP;
varying vec3 vN;
varying vec3 vV;
void main(){
  float f = pow(clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.4);
  vec3 c = mix(vec3(0.16, 0.09, 0.42), vec3(0.70, 0.58, 1.0), f * f);
  gl_FragColor = vec4(c * f * (0.40 + 0.28 * uP) * uO, 1.0);
}
`;
