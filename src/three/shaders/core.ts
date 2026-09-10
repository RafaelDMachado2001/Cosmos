/**
 * Shader do núcleo. Portado praticamente literalmente do protótipo — ele é a
 * especificação visual exata, não uma sugestão.
 *
 * Vertex: simplex noise 3D em três oitavas (pesos 0.30/0.13/0.05, frequências
 * 1.05/2.6/5.2, animadas em eixos diferentes) deslocando a malha ao longo da
 * normal. A superfície incha na direção do ponteiro.
 *
 * Fragment: base roxa escura, sobre ela um degradê angular girando a
 * 0.045 rad/s percorrendo roxo, verde, laranja e vermelho, aplicado no fresnel
 * e nos veios internos. `uPulse` faz a energia percorrer a superfície.
 */

export const CORE_VERTEX_SHADER = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform vec2 uMouse;
varying vec3 vNormal; varying vec3 vView; varying float vN;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  vec3 p = position;
  float n1 = snoise(p*1.05 + vec3(0.0, 0.0, uTime*0.16));
  float n2 = snoise(p*2.6 + vec3(uTime*0.10, 0.0, 0.0));
  float n3 = snoise(p*5.2 - vec3(0.0, uTime*0.07, 0.0));
  float d = n1*0.30 + n2*0.13 + n3*0.05;
  float pull = smoothstep(0.55, 1.0, dot(normalize(p), normalize(vec3(uMouse, 0.85))));
  d += pull * 0.16;
  vN = d;
  vec3 dp = p + normal * d * uAmp;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(dp, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const CORE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform float uOpacity; uniform float uTime; uniform float uPulse;
varying vec3 vNormal; varying vec3 vView; varying float vN;
void main(){
  float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
  vec3 core = vec3(0.042, 0.030, 0.108);
  vec3 mid  = vec3(0.165, 0.118, 0.395);
  vec3 col = mix(core, mid, smoothstep(-0.25, 0.35, vN));

  vec3 cPurple = vec3(0.470, 0.330, 1.000);
  vec3 cGreen  = vec3(0.240, 0.860, 0.560);
  vec3 cOrange = vec3(1.000, 0.560, 0.210);
  vec3 cRed    = vec3(0.930, 0.200, 0.330);

  float ang = atan(vNormal.y, vNormal.x);
  float g = fract((ang / 6.2831853) + 0.5 + uTime * 0.045 + vN * 0.35);
  float seg = g * 4.0;
  vec3 grad = mix(cPurple, cGreen, smoothstep(0.0, 1.0, seg));
  grad = mix(grad, cOrange, smoothstep(1.0, 2.0, seg));
  grad = mix(grad, cRed, smoothstep(2.0, 3.0, seg));
  grad = mix(grad, cPurple, smoothstep(3.0, 4.0, seg));

  float energy = fres * (0.55 + 0.55 * uPulse);
  col = mix(col, grad, clamp(energy, 0.0, 1.0));

  float vein = pow(1.0 - abs(vN * 2.1), 9.0);
  col += vein * grad * (0.40 + 0.60 * uPulse);

  float a = clamp(0.14 + fres * (0.44 + 0.30 * uPulse) + vein * (0.34 + 0.30 * uPulse), 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(col, a);
}
`;
