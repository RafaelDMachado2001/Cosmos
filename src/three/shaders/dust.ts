/**
 * Poeira cósmica. Deliberadamente discreta: o handoff lista "excesso de
 * partículas" entre as coisas a evitar.
 *
 * O tamanho do ponto cai com a distância e o alfa some ao longo da
 * profundidade, para a nuvem não virar um chuvisco uniforme.
 */

export const DUST_VERTEX_SHADER = /* glsl */ `
attribute float aSize;
uniform float uPR;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 260.0 * uPR / max(1.0, -mv.z);
  vA = clamp(1.0 - (-mv.z) / 34.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const DUST_FRAGMENT_SHADER = /* glsl */ `
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(0.78, 0.76, 0.95), a * vA * 0.55);
}
`;
