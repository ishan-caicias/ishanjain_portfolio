/* space-engine.js — WebGL starfield engine for Ishan's portfolio.
   <space-engine> custom element:
   - Streams 200,000 star records from a packed binary chunk (assets/stars.png → ArrayBuffer)
     into the GPU incrementally (progress events), rendered as shader point-sprites.
   - Curated bodies from window.CELESTIAL rendered as gold beacons (hover/click picking).
   - 360° free-look (drag / touch, inertia), warp travel with radial star trails,
     constellation line figures, wireframe spaceship parsed from assets/ship.obj.
   Events on window: cosmos:progress {loaded,total} · cosmos:aim {ra,dec} ·
   cosmos:hover {id,x,y} · cosmos:unhover · cosmos:select {id} · cosmos:warp {id,t,ly} ·
   cosmos:arrive {id} · cosmos:home · cosmos:ready
   Attributes: density (0..1), constellations ("on"/"off"), ship ("on"/"off")
   Methods: travelTo(id), goHome(), randomBody() */
import {
  SHIP_VIEW_DEPTH,
  SHIP_BASE_FOV,
  SHIP_NDC_Y_OFFSET,
  SHIP_BOB_NDC,
  SHIP_SPRING_OMEGA,
  SHIP_SPRING_ZETA,
  SHIP_LAG_YAW,
  SHIP_LAG_PITCH,
  SHIP_MAX_DT,
  shipScaleFactor,
  ndcToView,
  springStep,
  buildPlumeVertices,
  plumeFlareLength,
  plumeAlpha,
  rimColorAt,
  PLUME_VERTEX_COUNT,
} from "./ship-dynamics";
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;
  const PHOTO_T = {
    planet: 1,
    moon: 1,
    dwarf: 1,
    nebula: 2,
    galaxy: 3,
    cluster: 4,
    deepfield: 6,
  };

  /* ---------- tiny mat4 helpers (column-major) ---------- */
  function persp(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2),
      nf = 1 / (near - far);
    return [
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) * nf,
      -1,
      0,
      0,
      2 * far * near * nf,
      0,
    ];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    return o;
  }
  function viewFrom(dir) {
    // camera at origin looking along dir, up = +z (celestial north)
    let ux = 0,
      uy = 0,
      uz = 1;
    if (Math.abs(dir[2]) > 0.999) {
      ux = 1;
      uy = 0;
      uz = 0;
    }
    let rx = dir[1] * uz - dir[2] * uy,
      ry = dir[2] * ux - dir[0] * uz,
      rz = dir[0] * uy - dir[1] * ux;
    const rl = Math.hypot(rx, ry, rz);
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const vx = ry * dir[2] - rz * dir[1],
      vy = rz * dir[0] - rx * dir[2],
      vz = rx * dir[1] - ry * dir[0];
    return [
      rx,
      vx,
      -dir[0],
      0,
      ry,
      vy,
      -dir[1],
      0,
      rz,
      vz,
      -dir[2],
      0,
      0,
      0,
      0,
      1,
    ];
  }
  const raDecToDir = (ra, dec) => {
    const cd = Math.cos(dec * D2R);
    return [
      cd * Math.cos(ra * D2R),
      cd * Math.sin(ra * D2R),
      Math.sin(dec * D2R),
    ];
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /* ---------- shaders ---------- */
  const STAR_VS = `
  attribute vec3 aPos; attribute vec4 aMeta; // size, colorIdx, twinkleSeed, flag
  uniform mat4 uProj, uView; uniform vec3 uCam;
  uniform float uTime, uSize, uMode, uPulse;
  uniform float uBeta, uGamma, uHaloAmp; uniform vec3 uWarpDir;
  varying vec3 vColor; varying float vAlpha; varying float vMode; varying float vType; varying float vSeed; varying float vHalo;
  vec3 ramp(float t){
    // Planckian star sequence O->M (real stellar chromaticities)
    vec3 c0=vec3(0.608,0.690,1.000), c1=vec3(0.792,0.843,1.000), c2=vec3(0.973,0.969,1.000),
         c3=vec3(1.000,0.957,0.918), c4=vec3(1.000,0.824,0.631), c5=vec3(1.000,0.800,0.435);
    if(t<0.2) return mix(c0,c1,t/0.2);
    if(t<0.4) return mix(c1,c2,(t-0.2)/0.2);
    if(t<0.6) return mix(c2,c3,(t-0.4)/0.2);
    if(t<0.8) return mix(c3,c4,(t-0.6)/0.2);
    return mix(c4,c5,(t-0.8)/0.2);
  }
  vec3 aberrate(vec3 p){
    // relativistic aberration: apparent directions crowd toward the direction of travel
    if(uBeta < 0.001) return p;
    float dist = length(p); vec3 d = p/dist;
    float c = dot(d, uWarpDir);
    float cp = clamp((c + uBeta)/(1.0 + uBeta*c), -1.0, 1.0);
    vec3 perp = d - c*uWarpDir; float pl = length(perp);
    float sp = sqrt(max(0.0, 1.0-cp*cp));
    return (uWarpDir*cp + (pl>1e-5 ? perp*(sp/pl) : vec3(0.0))) * dist;
  }
  void main(){
    vec3 p = aberrate(aPos - uCam);
    vec4 clip = uProj * uView * vec4(p,1.0);
    gl_Position = clip;
    float dist = length(p);
    float base = aMeta.x * 255.0;
    float px;
    vHalo = 0.0;
    if(uMode > 0.5){
      float ty = aMeta.w * 255.0;
      float boost = 1.0;
      if (ty > 1.5 && ty < 2.5) boost = 2.2;      // nebula
      else if (ty > 2.5 && ty < 3.5) boost = 2.0; // galaxy
      else if (ty > 3.5 && ty < 4.5) boost = 1.8; // globular
      else if (ty > 4.5 && ty < 5.5) boost = 1.8; // open cluster
      else if (ty > 5.5 && ty < 6.5) boost = 1.6; // deep field
      else if (ty > 7.5 && ty < 8.5) boost = 2.3; // black hole
      else if (ty > 0.5 && ty < 1.5) boost = 0.9; // planet disc
      px = (10.0 + base*0.05) * (240.0/max(dist,14.0));
      px = clamp(px, 7.0, 110.0) * boost;
      if (ty < 0.5) px *= (1.0 + 0.12*sin(uTime*2.2 + aMeta.z*40.0)) * uPulse;
      vColor = ramp(aMeta.y); vAlpha = 1.0;
      vType = ty; vSeed = aMeta.z * 6.2831;
    } else {
      vSeed = 0.0;
      float dty = aMeta.w * 255.0;
      vType = dty;
      // photometric: Pogson magnitude -> flux over the full Hipparcos window; no twinkle in vacuum
      float mag = 12.5 - aMeta.x*14.0;
      float flux = pow(10.0, -0.4*(mag - 2.0));
      float fl = pow(flux, 0.28);
      px = (0.9 + 2.6*fl) * uSize * (520.0/max(dist,90.0));
      px = clamp(px, 1.0, 13.0);
      vHalo = smoothstep(0.60, 1.0, fl) * uHaloAmp;
      px *= 1.0 + vHalo*1.5;
      vColor = ramp(aMeta.y);
      vAlpha = 0.10 + 0.90*sqrt(clamp(flux, 0.0, 1.4));
      if (dty > 0.5) {
        vHalo = 0.0;
        if (dty < 1.5)      { px *= 2.6; vAlpha *= 0.85; }  // open cluster glow (Hunt-Reffert / MWSC / OCDR2)
        else if (dty < 2.5) { px *= 0.8; }                   // white dwarf (Gentile Fusillo eDR3)
        else if (dty < 3.5) {                                // SDSS galaxy: Hubble-flow reddening with depth
          px *= 1.15;
          vColor = mix(vColor, vec3(1.0, 0.45, 0.30), clamp((dist - 800.0)/500.0, 0.0, 0.75));
        }
        else if (dty < 4.5) { px *= 0.95; vColor = mix(vColor, vec3(0.55, 0.95, 0.95), 0.35); } // GD-1 stream
        else if (dty < 5.5) { vColor = mix(vColor, vec3(1.0, 0.85, 0.45), 0.25); }               // exoplanet host
        else if (dty < 6.5) { px *= 0.85; }                  // DR3 asteroid
        else                { px *= 1.3; vAlpha *= 0.7; }    // Oort cloud
      }
    }
    if (uBeta > 0.001) {
      // relativistic Doppler: blueshift + beaming ahead, redshift + dimming astern
      float cp2 = dot(p, uWarpDir)/max(dist, 1e-4);
      float D = 1.0/(uGamma*(1.0 - uBeta*cp2));
      vColor = mix(vColor, vec3(0.60,0.74,1.0), clamp((D-1.0)*0.9, 0.0, 0.65));
      vColor = mix(vColor, vec3(1.0,0.40,0.26), clamp((1.0-D)*1.1, 0.0, 0.70));
      vAlpha *= clamp(D*D, 0.25, 2.2);
    }
    gl_PointSize = px;
    vMode = uMode;
  }`;
  const STAR_FS = `
  precision mediump float;
  varying vec3 vColor; varying float vAlpha; varying float vMode; varying float vType; varying float vSeed; varying float vHalo;
  float hash2(vec2 p, float s){ return fract(sin(dot(p, vec2(127.1, 311.7)) + s) * 43758.5453); }
  void main(){
    vec2 pc = gl_PointCoord - 0.5;
    float d = length(pc)*2.0;
    vec3 col = vColor;
    float a = 0.0;
    if(vMode > 0.5){
      float ty = floor(vType + 0.5);
      if (ty > 7.5 && ty < 8.5) {
        // BLACK HOLE: photon ring + lensed accretion arcs around a dark interior
        if (d > 1.0) discard;
        float ring = exp(-pow(abs(d - 0.40) * 7.5, 1.7));
        float arc = exp(-pow(abs(length(vec2(pc.x, pc.y*2.7)) - 0.33) * 9.0, 2.0)) * 0.85;
        a = min(1.0, ring * 1.2 + arc);
        a *= smoothstep(0.14, 0.30, d);
        col = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.93, 0.78), ring);
      } else if (ty < 0.5 || ty > 6.5) {
        // STAR (and constellation anchor): bright core + diffraction spikes
        if (d > 1.0) discard;
        float core = exp(-d*d*7.0);
        float spike = max(0.0,1.0-abs(pc.x)*14.0)*max(0.0,1.0-abs(pc.y)*2.2)
                    + max(0.0,1.0-abs(pc.y)*14.0)*max(0.0,1.0-abs(pc.x)*2.2);
        a = min(1.0, core*1.2 + spike*0.5*(1.0-d));
        if (ty > 6.5) a *= 0.55;
      } else if (ty < 1.5) {
        // PLANET / MOON: solid lit disc with limb darkening + faint halo
        float disc = smoothstep(0.60, 0.52, d);
        float limb = 1.0 - 0.5*smoothstep(0.1, 0.6, d);
        float shade = 0.45 + 0.55*smoothstep(0.45, -0.35, pc.x + pc.y*0.3);
        col = vColor * limb * shade + vec3(0.05);
        a = disc + exp(-d*d*3.5)*0.10;
      } else if (ty < 2.5) {
        // NEBULA: irregular lobed cloud with ragged edges
        vec2 o1 = vec2(cos(vSeed), sin(vSeed)) * 0.13;
        vec2 o2 = vec2(cos(vSeed+2.4), sin(vSeed+2.4)) * 0.15;
        vec2 o3 = vec2(cos(vSeed+4.5), sin(vSeed+4.5)) * 0.11;
        float g = exp(-dot(pc-o1,pc-o1)*13.0) + exp(-dot(pc-o2,pc-o2)*11.0)
                + exp(-dot(pc-o3,pc-o3)*16.0) + exp(-dot(pc,pc)*9.0)*0.7;
        float ang = atan(pc.y, pc.x);
        g *= 0.72 + 0.28*sin(ang*5.0 + vSeed*3.0);
        a = min(0.92, g*0.5);
        col = mix(vColor, vec3(1.0,0.98,0.95), exp(-d*d*10.0)*0.35);
      } else if (ty < 3.5) {
        // GALAXY: inclined disc + brilliant nucleus
        float ca = cos(vSeed), sa = sin(vSeed);
        vec2 q = vec2(ca*pc.x - sa*pc.y, (sa*pc.x + ca*pc.y) * 3.4);
        float disc = exp(-dot(q,q)*7.0);
        float core = exp(-dot(pc,pc)*70.0);
        a = min(1.0, disc*0.8 + core*1.3);
        col = mix(vColor*0.9, vec3(1.0,0.97,0.9), core);
      } else if (ty < 4.5) {
        // GLOBULAR CLUSTER: dense grainy ball of stars
        float base2 = exp(-d*d*4.5);
        vec2 gp = floor((pc+0.5)*10.0);
        float h = hash2(gp, vSeed*40.0);
        float grain = step(0.5, h) * exp(-d*d*3.0);
        a = min(1.0, base2*0.35 + grain*0.8);
      } else if (ty < 5.5) {
        // OPEN CLUSTER: a scattered handful of member stars
        a = exp(-d*d*3.0) * 0.10;
        vec2 gp = floor((pc+0.5)*5.0);
        float h = hash2(gp, vSeed*40.0);
        vec2 c = (gp+0.5)/5.0 - 0.5 + (vec2(fract(h*7.3), fract(h*13.7)) - 0.5)*0.14;
        float dd = length(pc-c)*14.0;
        a += step(0.42, h) * exp(-dd*dd) * smoothstep(1.05, 0.5, d);
        a = min(1.0, a);
      } else {
        // DEEP FIELD: a soft patch peppered with tiny specks
        vec2 gp = floor((pc+0.5)*13.0);
        float h = hash2(gp, vSeed*40.0);
        a = step(0.78, h) * (0.35+0.65*fract(h*5.0)) * smoothstep(0.95, 0.7, max(abs(pc.x),abs(pc.y))*2.0);
        a += exp(-d*d*4.0)*0.05;
      }
      if (a <= 0.004) discard;
    } else {
      if(d>1.0) discard;
      float ty2 = floor(vType + 0.5);
      if (ty2 > 0.5 && ty2 < 1.5)      { a = exp(-d*d*2.6)*0.80; }  // cluster: soft glow, no PSF core
      else if (ty2 > 2.5 && ty2 < 3.5) { a = exp(-d*d*4.0)*0.85; }  // galaxy smudge
      else if (ty2 > 6.5)              { a = exp(-d*d*3.2)*0.55; }  // oort dust grain
      else { a = exp(-d*d*6.0) + vHalo*exp(-d*3.0)*0.18; }          // stellar PSF + bloom
    }
    gl_FragColor = vec4(col, a*vAlpha);
  }`;
  const TRAIL_VS = `
  attribute vec3 aPos; attribute vec4 aMeta; // size, ci, tw, endFlag
  uniform mat4 uProj, uView; uniform vec3 uCam, uCamPrev;
  uniform float uBeta; uniform vec3 uWarpDir;
  varying vec3 vColor; varying float vAlpha;
  vec3 ramp(float t){
    vec3 c0=vec3(0.608,0.690,1.000), c2=vec3(0.973,0.969,1.000), c4=vec3(1.000,0.824,0.631), c5=vec3(1.000,0.800,0.435);
    if(t<0.4) return mix(c0,c2,t/0.4);
    if(t<0.8) return mix(c2,c4,(t-0.4)/0.4);
    return mix(c4,c5,(t-0.8)/0.2);
  }
  vec3 aberrate(vec3 p){
    if(uBeta < 0.001) return p;
    float dist = length(p); vec3 d = p/dist;
    float c = dot(d, uWarpDir);
    float cp = clamp((c + uBeta)/(1.0 + uBeta*c), -1.0, 1.0);
    vec3 perp = d - c*uWarpDir; float pl = length(perp);
    float sp = sqrt(max(0.0, 1.0-cp*cp));
    return (uWarpDir*cp + (pl>1e-5 ? perp*(sp/pl) : vec3(0.0))) * dist;
  }
  void main(){
    vec3 cam = aMeta.w > 0.5 ? uCamPrev : uCam;
    gl_Position = uProj * uView * vec4(aberrate(aPos - cam), 1.0);
    vColor = ramp(aMeta.y);
    vAlpha = 0.10 + 0.30*aMeta.x;
  }`;
  const TRAIL_FS = `
  precision mediump float; varying vec3 vColor; varying float vAlpha; uniform float uWarp;
  void main(){ gl_FragColor = vec4(vColor, vAlpha*uWarp); }`;
  const FLAT_VS = `
  attribute vec3 aPos; uniform mat4 uMVP; uniform float uPtSize;
  void main(){ gl_Position = uMVP * vec4(aPos,1.0); gl_PointSize = uPtSize; }`;
  const FLAT_FS = `
  precision mediump float; uniform vec4 uColor; uniform float uRound;
  void main(){
    float a = 1.0;
    if(uRound>0.5){ float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0) discard; a=exp(-d*d*4.0); }
    gl_FragColor = vec4(uColor.rgb, uColor.a*a);
  }`;
  // Photographic bodies: NASA/ESA imagery billboards for DSOs + texture-mapped planet globes
  const PHOTO_VS = `
  attribute vec3 aCenter; attribute vec2 aCorner; attribute vec2 aLocal; attribute vec4 aCell; attribute vec4 aMisc;
  uniform mat4 uProj, uView; uniform vec3 uCam; uniform vec2 uVp;
  uniform float uBeta; uniform vec3 uWarpDir;
  varying vec2 vLocal; varying vec4 vCell; varying vec4 vMisc; varying float vZ;
  vec3 aberrate(vec3 p){
    if(uBeta < 0.001) return p;
    float dist = length(p); vec3 d = p/dist;
    float c = dot(d, uWarpDir);
    float cp = clamp((c + uBeta)/(1.0 + uBeta*c), -1.0, 1.0);
    vec3 perp = d - c*uWarpDir; float pl = length(perp);
    float sp = sqrt(max(0.0, 1.0-cp*cp));
    return (uWarpDir*cp + (pl>1e-5 ? perp*(sp/pl) : vec3(0.0))) * dist;
  }
  void main(){
    vec3 p = aberrate(aCenter - uCam);
    // cosmological redshift proxy from log-compressed depth (z ~ d / 14.1 Gly)
    vZ = clamp(pow(10.0, (length(aCenter) - 150.0)/128.0) * 7.1e-11, 0.0, 1.3);
    vec4 clip = uProj * uView * vec4(p, 1.0);
    float dist = length(p);
    float px = (10.0 + aMisc.x*0.05) * (240.0/max(dist,14.0));
    px = clamp(px, 12.0, 130.0) * aMisc.w;
    clip.xy += aCorner * (px / uVp) * clip.w;
    gl_Position = clip;
    vLocal = aLocal; vCell = aCell; vMisc = aMisc;
  }`;
  const PHOTO_FS = `
  precision mediump float;
  uniform sampler2D uTex; uniform float uTime, uFade;
  varying vec2 vLocal; varying vec4 vCell; varying vec4 vMisc; varying float vZ;
  void main(){
    float ty = vMisc.y;
    vec3 col = vec3(0.0);
    float a = 0.0;
    if (ty < 1.9) {
      // texture-mapped, lit, slowly rotating globe (ring flag: ty = 1.5)
      float r2 = dot(vLocal, vLocal);
      if (r2 < 1.0) {
        float nz = sqrt(1.0 - r2);
        float lat = asin(clamp(vLocal.y, -1.0, 1.0));
        float lon = atan(vLocal.x, nz) + uTime*0.06 + vMisc.z*6.2831853;
        vec2 uv = vec2(fract(lon*0.15915494), 0.5 - lat*0.31830988);
        uv = uv*0.96 + 0.02;
        vec3 tex = texture2D(uTex, vCell.xy + uv*vCell.zw).rgb;
        vec3 n = vec3(vLocal, nz);
        float diff = max(0.0, dot(n, normalize(vec3(-0.55, 0.30, 0.78))));
        float shade = (0.05 + 1.08*diff) * (0.72 + 0.28*nz);
        col = tex * shade;
        col += vec3(0.30, 0.42, 0.75) * pow(1.0 - nz, 3.0) * diff * 0.4;
        a = smoothstep(1.0, 0.90, r2);
      }
      if (ty > 1.25) {
        float rr = length(vec2(vLocal.x, vLocal.y*3.6));
        float band = smoothstep(1.16, 1.30, rr) * smoothstep(1.98, 1.78, rr);
        band *= 0.8 + 0.2*sin(rr*36.0);
        float gap = smoothstep(1.50, 1.58, rr) * (1.0 - smoothstep(1.60, 1.68, rr));
        band *= 1.0 - 0.8*gap;
        float ra = band * step(1.0, r2) * 0.5;
        col += vec3(0.82, 0.72, 0.55) * ra;
        a = max(a, ra);
      }
      gl_FragColor = vec4(col * uFade, a);
    } else {
      // deep-sky photograph billboard: additive over the starfield, radial-masked
      vec2 uv = vCell.xy + vec2(vLocal.x*0.5 + 0.5, 0.5 - vLocal.y*0.5) * vCell.zw;
      vec3 tex = texture2D(uTex, uv).rgb;
      float r = length(vLocal);
      float vig = smoothstep(1.0, 0.58, r);
      col = tex * (ty > 5.5 ? 0.95 : 1.12);
      float tyf = floor(ty + 0.5);
      if (vZ > 0.02 && (abs(tyf - 3.0) < 0.1 || abs(tyf - 6.0) < 0.1)) {
        // Hubble-flow redshift: distant galaxies and deep fields shift toward the red
        float rs = clamp(vZ*0.85, 0.0, 0.8);
        col = mix(col, vec3(col.r*1.28 + 0.04, col.g*0.60, col.b*0.34), rs);
      }
      gl_FragColor = vec4(col * vig * uFade, 1.0);
    }
  }`;

  // Milky Way diffuse layer: integrated starlight + dust lanes, equirect texture sampled by view ray
  const BAND_VS = `
  attribute vec2 aPos; varying vec2 vNdc;
  void main(){ vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const BAND_FS = `
  precision mediump float;
  uniform sampler2D uTex; uniform vec3 uRight, uUp, uFwd;
  uniform float uTanY, uAspect, uFade;
  uniform float uBeta, uGamma; uniform vec3 uWarpDir;
  varying vec2 vNdc;
  void main(){
    vec3 d = normalize(uFwd + uRight*vNdc.x*uTanY*uAspect + uUp*vNdc.y*uTanY);
    float dop = 1.0;
    if (uBeta > 0.001) {
      float c = dot(d, uWarpDir);
      dop = 1.0/(uGamma*(1.0 - uBeta*c));
      float cp = clamp((c - uBeta)/(1.0 - uBeta*c), -1.0, 1.0); // inverse aberration back to source direction
      vec3 perp = d - c*uWarpDir; float pl = length(perp);
      float sp = sqrt(max(0.0, 1.0-cp*cp));
      d = uWarpDir*cp + (pl>1e-5 ? perp*(sp/pl) : vec3(0.0));
    }
    float ra = atan(d.y, d.x);
    float dec = asin(clamp(d.z, -1.0, 1.0));
    vec3 col = texture2D(uTex, vec2(ra*0.15915494 + 0.5, 0.5 - dec*0.31830988)).rgb;
    if (uBeta > 0.001) {
      col = mix(col, vec3(0.62,0.75,1.0)*length(col)*1.4, clamp((dop-1.0)*0.8, 0.0, 0.6));
      col = mix(col, vec3(1.0,0.45,0.3)*length(col)*1.2, clamp((1.0-dop)*1.0, 0.0, 0.65));
      col *= clamp(dop*dop, 0.3, 2.0);
    }
    gl_FragColor = vec4(col*uFade, 1.0);
  }`;

  // P3 (TR-018): layered exhaust plume — crossed-quad cones per engine,
  // vertex alpha runs 1 (nozzle) → 0 (tip); additive blending does the glow.
  const PLUME_VS = `
  attribute vec4 aPos; uniform mat4 uMVP; varying float vA;
  void main(){ gl_Position = uMVP * vec4(aPos.xyz, 1.0); vA = aPos.w; }`;
  const PLUME_FS = `
  precision mediump float; uniform float uAlpha; varying float vA;
  void main(){
    vec3 col = mix(vec3(1.0, 0.45, 0.15), vec3(1.0, 0.93, 0.78), vA);
    gl_FragColor = vec4(col, vA * uAlpha);
  }`;

  function compile(gl, vsSrc, fsSrc) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error("[space-engine]", gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.error("[space-engine] link", gl.getProgramInfoLog(p));
    const u = {},
      n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return {
      prog: p,
      u,
      aPos: gl.getAttribLocation(p, "aPos"),
      aMeta: gl.getAttribLocation(p, "aMeta"),
    };
  }

  const emit = (name, detail) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  class SpaceEngine extends HTMLElement {
    static get observedAttributes() {
      return ["density", "constellations", "ship", "craft"];
    }
    constructor() {
      super();
      this.yaw = 52 * D2R;
      this.pitch = -10 * D2R;
      this.velYaw = 0;
      this.velPitch = 0;
      this.cam = [0, 0, 0];
      this.camPrev = [0, 0, 0];
      this.warp = {
        mode: "idle",
        t: 0,
        target: null,
        from: null,
        fromYaw: 0,
        fromPitch: 0,
        toYaw: 0,
        toPitch: 0,
        dur: 0,
        start: 0,
      };
      this.loaded = 0;
      this.total = 200000;
      this.density = 1;
      this.showCon = true;
      this.showShip = true;
      this.hoverId = null;
      this.arrivedId = null;
      this.bodies = [];
      this.lookVel = 0;
      this.stations = [];
      this.ship = { x: 0, y: 0.74, s: 0.45, a: 0.5 };
      this.reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      this._raf = 0;
      this._frame = 0;
      this.tier = 2;
      this._ft = 16;
      this._ftBad = 0;
      this._ftGood = 0;
      this._lastT = 0;
      this._beta = 0;
      this._warpDir = [0, 0, 1];
      this._shipFlip = 0;
      this.noGL = false;
      this._ctxLost = false;
      // ship-v2 (ADR-0002): textured GLB craft, opt-in via the "craft" attribute.
      // null → the original gold-wireframe path is untouched.
      this.craft = null;
      this.craftTier = "off";
      this._craftLoading = null;
      // ship-v2 P2: spring velocities + last integration time for the
      // world-space flight dynamics (ship-dynamics.ts).
      this._shipVel = { x: 0, y: 0 };
      this._shipT = 0;
      this._rimK = 0; // P3: 0 = cool in-flight rim, 1 = warm arrived rim
    }
    attributeChangedCallback(k, _o, v) {
      if (k === "density")
        this.density = Math.max(0.05, Math.min(1, parseFloat(v) || 1));
      if (k === "constellations") this.showCon = v !== "off";
      if (k === "ship") this.showShip = v !== "off";
      if (k === "craft") {
        this.craftTier = v === "1k" || v === "2k" ? v : "off";
        if (this.craftTier === "off") this.craft = null;
        else if (this._init) this._loadCraft();
      }
    }
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const c = (this.canvas = document.createElement("canvas"));
      Object.assign(c.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "crosshair",
      });
      this.style.display = "block";
      this.appendChild(c);
      // depth: true since ship-v2 (ADR-0002) — the textured craft needs a depth
      // buffer for self-occlusion, and a context's depth setting cannot change
      // after creation. Depth testing is enabled ONLY inside the craft pass;
      // every other pass is unaffected.
      const gl = (this.gl = c.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }));
      if (!gl) {
        this._domFallback();
        return;
      }
      c.addEventListener("webglcontextlost", (ev) => {
        ev.preventDefault();
        this._ctxLost = true;
      });
      c.addEventListener("webglcontextrestored", () => {
        this._ctxLost = false;
        this._rebuildGL();
      });
      this.pStar = compile(gl, STAR_VS, STAR_FS);
      this.pTrail = compile(gl, TRAIL_VS, TRAIL_FS);
      this.pFlat = compile(gl, FLAT_VS, FLAT_FS);
      this.pPhoto = compile(gl, PHOTO_VS, PHOTO_FS);
      this.pBand = compile(gl, BAND_VS, BAND_FS);
      this.pPlume = compile(gl, PLUME_VS, PLUME_FS);
      const gp = this.pPhoto;
      gp.aCenter = gl.getAttribLocation(gp.prog, "aCenter");
      gp.aCorner = gl.getAttribLocation(gp.prog, "aCorner");
      gp.aLocal = gl.getAttribLocation(gp.prog, "aLocal");
      gp.aCell = gl.getAttribLocation(gp.prog, "aCell");
      gp.aMisc2 = gl.getAttribLocation(gp.prog, "aMisc");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive — starlight
      this.buf = {
        stars: gl.createBuffer(),
        trails: gl.createBuffer(),
        bodies: gl.createBuffer(),
        con: gl.createBuffer(),
        ship: gl.createBuffer(),
        glow: gl.createBuffer(),
        photo: gl.createBuffer(),
        band: gl.createBuffer(),
        plume: gl.createBuffer(),
      };
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.band);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      this._resize = this._resize.bind(this);
      this._resize();
      new ResizeObserver(this._resize).observe(this);
      this._bindPointer();
      this._bindKeys();
      this._buildMilkyWay();
      this._waitCatalog().then(() => {
        // helmet scripts execute in arbitrary order; rebuild whenever the catalog grows, atlas once stable
        const build = () => {
          this._applyImgmap();
          this._buildBodies();
          this._buildConstellations();
        };
        build();
        let last = (window.CELESTIAL || []).length,
          lastChange = performance.now();
        const t0 = performance.now();
        const watch = () => {
          const n = (window.CELESTIAL || []).length;
          if (n !== last) {
            last = n;
            lastChange = performance.now();
            build();
          }
          if (
            (window.CELESTIAL_COMPLETE &&
              performance.now() - lastChange > 1500) ||
            performance.now() - t0 > 15000
          )
            this._buildAtlas();
          else setTimeout(watch, 150);
        };
        watch();
      });
      this._streamStars();
      this._loadShip();
      if (this.craftTier !== "off") this._loadCraft();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) this._kick();
      });
      this._kick();
    }
    _kick() {
      cancelAnimationFrame(this._raf);
      const loop = (t) => {
        this._raf = requestAnimationFrame(loop);
        this._tick(t);
      };
      this._raf = requestAnimationFrame(loop);
    }
    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = this.clientWidth || innerWidth,
        h = this.clientHeight || innerHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.dpr = dpr;
    }
    _applyImgmap() {
      const m = window.CELESTIAL_IMGMAP;
      if (!m || !window.CELESTIAL) return;
      window.CELESTIAL.forEach((e) => {
        const im = m[e.id];
        if (im && !e.img) {
          e.img = im[0];
          e.crd = im[1];
        }
      });
    }
    _waitCatalog() {
      return new Promise((res) => {
        const t0 = performance.now();
        // wait for the full catalog (base + extra layer); 3s fallback so a missing extra file can't hang the sky
        const chk = () =>
          window.CELESTIAL &&
          (window.CELESTIAL_COMPLETE || performance.now() - t0 > 3000)
            ? res()
            : setTimeout(chk, 40);
        chk();
      });
    }

    /* ---------- data streaming: packed binary chunks (Hipparcos field + Gaia deep layer) -> GPU in slices ---------- */
    async _streamStars() {
      const gl = this.gl;
      const loadChunk = async (url) => {
        const blob = await (await fetch(url)).blob();
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement("canvas");
        cv.width = bmp.width;
        cv.height = bmp.height;
        const cx = cv.getContext("2d", { willReadFrequently: true });
        cx.drawImage(bmp, 0, 0);
        const rgba = cx.getImageData(0, 0, bmp.width, bmp.height).data;
        const nPx = bmp.width * bmp.height;
        const raw = new Uint8Array(nPx * 3);
        for (let p = 0; p < nPx; p++) {
          raw[p * 3] = rgba[p * 4];
          raw[p * 3 + 1] = rgba[p * 4 + 1];
          raw[p * 3 + 2] = rgba[p * 4 + 2];
        }
        return raw;
      };
      try {
        const [rawStars, rawDeep] = await Promise.all([
          loadChunk("assets/stars-hip.png"),
          loadChunk("assets/deep.png").catch(() => new Uint8Array(0)),
        ]);
        const n1 = Math.floor(rawStars.length / 15),
          n2 = Math.floor(rawDeep.length / 15);
        const N = (this.total = n1 + n2);
        this.deepStart = n1;
        const dvS = new DataView(rawStars.buffer),
          dvD = new DataView(rawDeep.buffer);
        // interleaved point VBO: 3*f32 pos + 4*u8 meta (sizeByte, ci, twinkleSeed, type)
        const pts = new ArrayBuffer(N * 16);
        const pf = new Float32Array(pts),
          pb = new Uint8Array(pts);
        // trail VBO: every 3rd point, 2 verts
        const nT = Math.floor(N / 3);
        const trl = new ArrayBuffer(nT * 32);
        const tf = new Float32Array(trl),
          tb = new Uint8Array(trl);
        for (let i = 0; i < N; i++) {
          const deep = i >= n1;
          const dv = deep ? dvD : dvS;
          const o = (deep ? i - n1 : i) * 15;
          const x = dv.getFloat32(o, true),
            y = dv.getFloat32(o + 4, true),
            z = dv.getFloat32(o + 8, true);
          const raw = deep ? rawDeep : rawStars;
          const mag = raw[o + 12],
            ci = raw[o + 13],
            type = raw[o + 14];
          const sizeB = mag;
          const tw = ((i * 2654435761) >>> 0) & 255;
          const fo = i * 4;
          pf[fo] = x;
          pf[fo + 1] = y;
          pf[fo + 2] = z;
          pb[i * 16 + 12] = sizeB;
          pb[i * 16 + 13] = ci;
          pb[i * 16 + 14] = tw;
          pb[i * 16 + 15] = type;
          if (i % 3 === 0) {
            const ti = (i / 3) | 0;
            for (let e = 0; e < 2; e++) {
              const tfo = ti * 8 + e * 4,
                tbo = ti * 32 + e * 16;
              tf[tfo] = x;
              tf[tfo + 1] = y;
              tf[tfo + 2] = z;
              tb[tbo + 12] = sizeB;
              tb[tbo + 13] = ci;
              tb[tbo + 14] = tw;
              tb[tbo + 15] = e * 255;
            }
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.stars);
        gl.bufferData(gl.ARRAY_BUFFER, pts.byteLength, gl.STATIC_DRAW);
        this.fieldF = pf;
        this.fieldB = pb; // CPU copies — every field star is pickable
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.trails);
        gl.bufferData(gl.ARRAY_BUFFER, trl, gl.STATIC_DRAW);
        this.nTrail = nT * 2;
        // stream point data to GPU in slices for the HUD counter + zero long-frame stalls
        const CH = 8000,
          ptsU8 = new Uint8Array(pts);
        const step = () => {
          if (this.loaded >= N) {
            emit("cosmos:ready", {});
            return;
          }
          const n = Math.min(CH, N - this.loaded);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.stars);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            this.loaded * 16,
            ptsU8.subarray(this.loaded * 16, (this.loaded + n) * 16),
          );
          this.loaded += n;
          emit("cosmos:progress", { loaded: this.loaded, total: N });
          setTimeout(step, 16);
        };
        step();
      } catch (e) {
        console.error("[space-engine] star chunk failed", e);
        emit("cosmos:progress", { loaded: 0, total: 0 });
      }
    }

    _buildBodies() {
      const gl = this.gl;
      this.bodies = window.CELESTIAL.map((e) => {
        const dir = raDecToDir(e.ra, e.dec);
        const depth = 150 + 128 * Math.log10((e.ly || 0.001) + 1.5);
        return {
          e,
          dir,
          pos: [dir[0] * depth, dir[1] * depth, dir[2] * depth],
          depth,
          sx: -1,
          sy: -1,
          vis: false,
        };
      });
      // bodies with a loaded photo cell render as textured billboards/globes; the rest stay shader points
      const amap = this._atlasMap;
      const isPhoto = (e) => !!(amap && e.img && amap[e.id] && PHOTO_T[e.t]);
      const pts = this.bodies.filter((bd) => !isPhoto(bd.e));
      const buf = new ArrayBuffer(pts.length * 16);
      const f = new Float32Array(buf),
        b = new Uint8Array(buf);
      pts.forEach((bd, i) => {
        f[i * 4] = bd.pos[0];
        f[i * 4 + 1] = bd.pos[1];
        f[i * 4 + 2] = bd.pos[2];
        // meta: size boost by rarity, colorIdx approximated from entry color hue
        const r =
          { common: 60, uncommon: 90, rare: 130, epic: 180, legendary: 235 }[
            bd.e.r
          ] || 90;
        const c = bd.e.c || "#ffd54f";
        const rr = parseInt(c.slice(1, 3), 16),
          gg = parseInt(c.slice(3, 5), 16),
          bb = parseInt(c.slice(5, 7), 16);
        // map rough hue to ramp t: blue->0, white->0.4, amber->0.75, red->0.95
        let t = 0.45;
        if (bb > rr + 20) t = 0.12;
        else if (rr > bb + 60) t = gg > 150 ? 0.72 : 0.9;
        else if (rr > bb + 15) t = 0.66;
        const TC = {
          star: 0,
          planet: 1,
          moon: 1,
          dwarf: 1,
          nebula: 2,
          galaxy: 3,
          deepfield: 6,
          constellation: 7,
          blackhole: 8,
          craft: 9,
        };
        let tc = TC[bd.e.t] != null ? TC[bd.e.t] : 0;
        if (bd.e.t === "cluster") tc = /globular/i.test(bd.e.sp || "") ? 4 : 5;
        b[i * 16 + 12] = r;
        b[i * 16 + 13] = Math.round(t * 255);
        b[i * 16 + 14] = (i * 97) & 255;
        b[i * 16 + 15] = tc;
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.bodies);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
      this.nBodies = pts.length;
      if (amap) this._buildPhotoQuads();
    }
    /* ---------- photographic atlas: real NASA/ESA imagery for DSOs + planet surface maps ---------- */
    async _buildAtlas() {
      if (this._atlasStarted || !this.gl) return;
      this._atlasStarted = true;
      // the photographic atlas needs the FULL catalog (incl. the 2,500-object extension + imgmap);
      // wait for the completion flag even if the body/point pass already ran on the 3s fallback
      await new Promise((res) => {
        const t0 = performance.now();
        const chk = () =>
          window.CELESTIAL_COMPLETE || performance.now() - t0 > 20000
            ? res()
            : setTimeout(chk, 60);
        chk();
      });
      const gl = this.gl;
      this._applyImgmap();
      // fast path: pre-composed spritesheet (2 requests) — avoids flooding the file server with 267 loads
      try {
        const mj = await fetch("assets/atlas-map.json");
        if (mj.ok) {
          const map = await mj.json();
          if (Object.keys(map).length > 4) {
            const im = await new Promise((res, rej) => {
              const i2 = new Image();
              i2.onload = () => res(i2);
              i2.onerror = rej;
              i2.src = "assets/atlas.jpg";
            });
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              im,
            );
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_MIN_FILTER,
              gl.LINEAR_MIPMAP_LINEAR,
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_S,
              gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_WRAP_T,
              gl.CLAMP_TO_EDGE,
            );
            this._atlasMap = map;
            this.atlasTex = tex;
            this._photoFade = 0;
            this._buildBodies();
            return;
          }
        }
      } catch {
        /* fall through to per-image compose */
      }
      const entries = (window.CELESTIAL || []).filter(
        (e) => e.img && PHOTO_T[e.t],
      );
      if (!entries.length) return;
      let dso = entries.filter((e) => PHOTO_T[e.t] !== 1);
      const glo = entries.filter((e) => PHOTO_T[e.t] === 1);
      const COLS = 16,
        CELL = 256,
        AW = 4096;
      const maxDso = COLS * 16 - Math.ceil(glo.length / 4);
      if (dso.length > maxDso) dso = dso.slice(0, maxDso);
      const rows = Math.ceil((dso.length + Math.ceil(glo.length / 4)) / COLS);
      const AH = rows <= 4 ? 1024 : rows <= 8 ? 2048 : 4096;
      const cv = document.createElement("canvas");
      cv.width = AW;
      cv.height = AH;
      const cx = cv.getContext("2d");
      cx.fillStyle = "#000";
      cx.fillRect(0, 0, AW, AH);
      const map = {};
      const draw = (e, x, y, s) =>
        new Promise((res) => {
          const im = new Image();
          const to = setTimeout(() => res(), 9000);
          im.onload = () => {
            clearTimeout(to);
            const m = Math.min(im.width, im.height);
            cx.drawImage(
              im,
              (im.width - m) / 2,
              (im.height - m) / 2,
              m,
              m,
              x,
              y,
              s,
              s,
            );
            map[e.id] = [x / AW, y / AH, s / AW, s / AH];
            res();
          };
          im.onerror = () => {
            clearTimeout(to);
            res();
          };
          im.src = e.img;
        });
      // limited concurrency + one retry pass — mass-parallel loads can stall the file server
      const tasks = [];
      dso.forEach((e, i) =>
        tasks.push([e, (i % COLS) * CELL, ((i / COLS) | 0) * CELL, CELL]),
      );
      const base = dso.length;
      glo.forEach((e, i) => {
        const cell = base + ((i / 4) | 0),
          q = i % 4;
        tasks.push([
          e,
          (cell % COLS) * CELL + (q % 2) * 128,
          ((cell / COLS) | 0) * CELL + ((q / 2) | 0) * 128,
          128,
        ]);
      });
      const CHUNK = 12;
      for (let i = 0; i < tasks.length; i += CHUNK)
        await Promise.all(
          tasks
            .slice(i, i + CHUNK)
            .map((tk) => draw(tk[0], tk[1], tk[2], tk[3])),
        );
      const miss = tasks.filter((tk) => !map[tk[0].id]);
      for (let i = 0; i < miss.length; i += CHUNK)
        await Promise.all(
          miss
            .slice(i, i + CHUNK)
            .map((tk) => draw(tk[0], tk[1], tk[2], tk[3])),
        );
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._atlasMap = map;
      this.atlasTex = tex;
      this._photoFade = 0;
      this._buildBodies();
    }
    _buildPhotoQuads() {
      const gl = this.gl,
        amap = this._atlasMap;
      if (!amap) return;
      const list = this.bodies.filter(
        (bd) => bd.e.img && amap[bd.e.id] && PHOTO_T[bd.e.t],
      );
      const F = 15;
      const verts = new Float32Array(list.length * 6 * F);
      let k = 0;
      list.forEach((bd, i) => {
        const e = bd.e;
        let ty = PHOTO_T[e.t];
        if (e.t === "cluster") ty = /globular/i.test(e.sp || "") ? 4 : 5;
        const sizeB =
          { common: 60, uncommon: 90, rare: 130, epic: 180, legendary: 235 }[
            e.r
          ] || 90;
        let boost =
          ty === 1
            ? 1.5
            : ty === 2
              ? 3.4
              : ty === 3
                ? 3.2
                : ty === 4
                  ? 2.5
                  : ty === 5
                    ? 2.7
                    : 2.1;
        if (e.r === "legendary" && ty !== 1) boost *= 1.3;
        if (e.r === "uncommon") boost *= 0.72;
        if (e.r === "common") boost *= 0.52;
        const ring = e.id === "saturn";
        const seed = (((i * 2654435761) >>> 0) % 1000) / 1000;
        const ang = ty === 1 ? 0 : seed * 6.283;
        const ca = Math.cos(ang),
          sa = Math.sin(ang);
        const ex = ring ? 2.05 : 1.0;
        const cell = amap[e.id];
        const cs = [
          [-ex, -1],
          [ex, -1],
          [ex, 1],
          [-ex, -1],
          [ex, 1],
          [-ex, 1],
        ];
        for (const q of cs) {
          verts[k++] = bd.pos[0];
          verts[k++] = bd.pos[1];
          verts[k++] = bd.pos[2];
          verts[k++] = q[0] * ca - q[1] * sa;
          verts[k++] = q[0] * sa + q[1] * ca;
          verts[k++] = q[0];
          verts[k++] = q[1];
          verts[k++] = cell[0];
          verts[k++] = cell[1];
          verts[k++] = cell[2];
          verts[k++] = cell[3];
          verts[k++] = sizeB;
          verts[k++] = ty + (ring ? 0.5 : 0);
          verts[k++] = seed;
          verts[k++] = boost;
        }
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.photo);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      this.nPhoto = list.length * 6;
    }
    _buildConstellations() {
      const gl = this.gl,
        verts = [];
      const R = 720;
      window.CELESTIAL.forEach((e) => {
        if (!e.fig) return;
        const dirs = e.fig.s.map((sd) => raDecToDir(sd[0], sd[1]));
        e.fig.l.forEach(([a, b]) => {
          verts.push(
            dirs[a][0] * R,
            dirs[a][1] * R,
            dirs[a][2] * R,
            dirs[b][0] * R,
            dirs[b][1] * R,
            dirs[b][2] * R,
          );
        });
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.con);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      this.nCon = verts.length / 3;
    }
    async _loadShip() {
      try {
        const txt = await (await fetch("assets/ship.obj")).text();
        const vs = [];
        const edges = new Set();
        const push = (a, b) => {
          const k = a < b ? a + "_" + b : b + "_" + a;
          edges.add(k);
        };
        const faces = [];
        for (const line of txt.split("\n")) {
          if (line.startsWith("v ")) {
            const p = line.trim().split(/\s+/);
            vs.push([+p[1], +p[2], +p[3]]);
          } else if (line.startsWith("f ")) {
            const idx = line
              .trim()
              .split(/\s+/)
              .slice(1)
              .map((s) => parseInt(s.split("/")[0], 10) - 1);
            faces.push(idx);
          }
        }
        for (const f of faces)
          for (let i = 0; i < f.length; i++) push(f[i], f[(i + 1) % f.length]);
        // normalize: center + scale to unit box
        let mn = [1e9, 1e9, 1e9],
          mx = [-1e9, -1e9, -1e9];
        vs.forEach((v) => {
          for (let k = 0; k < 3; k++) {
            mn[k] = Math.min(mn[k], v[k]);
            mx[k] = Math.max(mx[k], v[k]);
          }
        });
        const ctr = [
          (mn[0] + mx[0]) / 2,
          (mn[1] + mx[1]) / 2,
          (mn[2] + mx[2]) / 2,
        ];
        const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
        const out = [];
        edges.forEach((k) => {
          const [a, b] = k.split("_").map(Number);
          for (const i of [a, b]) {
            const v = vs[i];
            out.push(
              (v[0] - ctr[0]) / span,
              (v[1] - ctr[1]) / span,
              (v[2] - ctr[2]) / span,
            );
          }
        });
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.ship);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
        this.nShip = out.length / 3;
      } catch (e) {
        console.warn("[space-engine] ship model failed", e);
        this.nShip = 0;
      }
    }
    async _loadCraft() {
      // ship-v2 (ADR-0002): textured GLB craft behind the "craft" attribute.
      // The loader + meshopt decoder are a lazy chunk — fetched only when the
      // flag is on. Any failure keeps the wireframe path, never a blank ship.
      const tier = this.craftTier;
      if (!this.gl || tier === "off" || this._craftLoading === tier) return;
      this._craftLoading = tier;
      this.dataset.craftState = "loading";
      emit("cosmos:craft", { state: "loading", tier });
      try {
        const { CraftShip } = await import("./craft-loader");
        const craft = await CraftShip.load(
          `assets/craft/sci-fi-fighter-${tier}.glb`,
        );
        craft.upload(this.gl);
        this.craft = craft;
        const waitReady = () => {
          if (this.craft !== craft) return; // superseded or turned off
          if (craft.ready) {
            this.dataset.craftState = "ready";
            emit("cosmos:craft", { state: "ready", tier });
          } else setTimeout(waitReady, 60);
        };
        waitReady();
      } catch (e) {
        console.warn("[space-engine] craft model failed, keeping wireframe", e);
        this.craft = null;
        this._craftLoading = null;
        this.dataset.craftState = "error";
        emit("cosmos:craft", { state: "error", tier });
      }
    }

    /* ---------- input ---------- */
    _bindPointer() {
      const c = this.canvas;
      let down = null,
        moved = 0;
      c.addEventListener("pointerdown", (ev) => {
        down = {
          x: ev.clientX,
          y: ev.clientY,
          yaw: this.yaw,
          pitch: this.pitch,
          t: performance.now(),
        };
        moved = 0;
        c.setPointerCapture(ev.pointerId);
      });
      c.addEventListener("pointermove", (ev) => {
        if (down) {
          const dx = ev.clientX - down.x,
            dy = ev.clientY - down.y;
          moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
          const k = 0.0022 * (70 / 60);
          this.yaw = down.yaw - dx * k;
          this.pitch = Math.max(-1.45, Math.min(1.45, down.pitch + dy * k));
          this.velYaw = 0;
          this.velPitch = 0;
        } else {
          this._pick(ev.clientX, ev.clientY);
        }
      });
      const up = (ev) => {
        if (!down) return;
        const dt = performance.now() - down.t;
        if (moved < 6 && dt < 600) this._click(ev.clientX, ev.clientY);
        down = null;
      };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", () => {
        down = null;
      });
      c.addEventListener("pointerleave", () => {
        if (this.hoverId) {
          this.hoverId = null;
          emit("cosmos:unhover", {});
          c.style.cursor = "crosshair";
        }
      });
    }
    fieldInfo(i) {
      if (!this.fieldF || i == null || i < 0 || i >= this.total) return null;
      const x = this.fieldF[i * 4],
        y = this.fieldF[i * 4 + 1],
        z = this.fieldF[i * 4 + 2];
      const r = Math.hypot(x, y, z) || 1;
      const ra = (Math.atan2(y, x) / D2R + 360) % 360;
      const dec = Math.asin(z / r) / D2R;
      const sizeB = this.fieldB[i * 16 + 12],
        ci = this.fieldB[i * 16 + 13];
      const type = this.fieldB[i * 16 + 15];
      // stars are linear (real parallax); deep-layer objects use the log-compressed depth scale
      const ly = type > 0 ? Math.pow(10, (r - 150) / 128) - 1.5 : r * 3.9;
      return { ra, dec, ly, mg: 12.5 - (sizeB / 255) * 14, ci, type };
    }
    _pickField(x, y) {
      // nearest field star within a ~0.6° cone of the cursor ray; -1 if none
      if (!this.fieldF || !this.total || this.loaded < this.total) return -1;
      const W = this.canvas.width / this.dpr,
        H = this.canvas.height / this.dpr;
      const fwd = [
        Math.cos(this.pitch) * Math.cos(this.yaw),
        Math.cos(this.pitch) * Math.sin(this.yaw),
        Math.sin(this.pitch),
      ];
      const v = viewFrom(fwd);
      const tanY = Math.tan(35 * D2R),
        aspect = W / H;
      const aN = ((x / W) * 2 - 1) * tanY * aspect,
        bN = -((y / H) * 2 - 1) * tanY;
      let ux = v[0] * aN + v[1] * bN + fwd[0];
      let uy = v[4] * aN + v[5] * bN + fwd[1];
      let uz = v[8] * aN + v[9] * bN + fwd[2];
      const rl = Math.hypot(ux, uy, uz);
      ux /= rl;
      uy /= rl;
      uz /= rl;
      const F = this.fieldF,
        cx = this.cam[0],
        cy = this.cam[1],
        cz = this.cam[2];
      let best = -1,
        bestScore = 0.99989;
      for (let i = 0; i < this.total; i++) {
        const sx = F[i * 4] - cx,
          sy = F[i * 4 + 1] - cy,
          sz = F[i * 4 + 2] - cz;
        const dt = sx * ux + sy * uy + sz * uz;
        if (dt <= 0) continue;
        const c2 = (dt * dt) / (sx * sx + sy * sy + sz * sz);
        if (c2 > bestScore) {
          bestScore = c2;
          best = i;
        }
      }
      return best;
    }
    _pick(cx, cy) {
      const rect = this.canvas.getBoundingClientRect();
      const x = cx - rect.left,
        y = cy - rect.top;
      let best = null,
        bd2 = 34 * 34;
      for (const b of this.bodies) {
        if (!b.vis) continue;
        const dx = b.sx - x,
          dy = b.sy - y,
          d2 = dx * dx + dy * dy;
        if (d2 < bd2) {
          bd2 = d2;
          best = b;
        }
      }
      let id = best ? best.e.id : null;
      if (!id) {
        this._fp = (this._fp || 0) + 1;
        if (this._fp % 2 === 0) {
          const fi = this._pickField(x, y);
          if (fi >= 0) id = "fs-" + fi;
        } else if (this.hoverId && String(this.hoverId).indexOf("fs-") === 0) {
          id = this.hoverId; // hold between throttled picks
        }
      }
      const hx = best ? best.sx + rect.left : cx,
        hy = best ? best.sy + rect.top : cy;
      if (id !== this.hoverId) {
        this.hoverId = id;
        this.canvas.style.cursor = id ? "pointer" : "crosshair";
        if (id) emit("cosmos:hover", { id, x: hx, y: hy });
        else emit("cosmos:unhover", {});
      } else if (id) {
        emit("cosmos:hover", { id, x: hx, y: hy });
      }
    }
    _click(cx, cy) {
      this._pick(cx, cy);
      if (this.hoverId) this.travelTo(this.hoverId);
    }

    /* ---------- travel ---------- */
    _loadDynTex(e) {
      // photographic close-up for warp targets that didn't get an atlas cell
      if (!e || !e.img || !PHOTO_T[e.t]) return;
      if (this._atlasMap && this._atlasMap[e.id]) return;
      if (this._dyn && this._dyn.id === e.id) return;
      const gl = this.gl;
      if (!gl) return;
      const im = new Image();
      im.onload = () => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (this._dyn && this._dyn.tex) gl.deleteTexture(this._dyn.tex);
        this._dyn = { id: e.id, tex, fade: 0, bd: null };
      };
      im.src = e.img;
    }
    travelTo(id, quiet) {
      if (this.noGL) {
        // no-render fallback: navigation still works, arrival is immediate
        this.arrivedId = id;
        emit("cosmos:select", { id, quiet: true });
        setTimeout(() => emit("cosmos:arrive", { id, quiet: true }), 250);
        return;
      }
      let b =
        this.bodies.find((x) => x.e.id === id) ||
        this.stations.find((x) => x.e.id === id);
      if (!b && String(id).indexOf("fs-") === 0 && this.fieldF) {
        const i = parseInt(String(id).slice(3), 10);
        if (i >= 0 && i < this.total) {
          const pos = [
            this.fieldF[i * 4],
            this.fieldF[i * 4 + 1],
            this.fieldF[i * 4 + 2],
          ];
          const L = Math.hypot(pos[0], pos[1], pos[2]) || 1;
          b = {
            e: { id, ly: L * 3.9 },
            pos,
            dir: [pos[0] / L, pos[1] / L, pos[2] / L],
          };
        }
      }
      if (!b || this.warp.mode === "warp" || this.warp.mode === "aim") return;
      this._loadDynTex(b.e);
      if (this.arrivedId === id) {
        emit("cosmos:arrive", { id, quiet: !!quiet });
        return;
      } // already on station — open dossier
      const dir = b.dir;
      const toYaw = Math.atan2(dir[1], dir[0]);
      const toPitch = Math.asin(Math.max(-1, Math.min(1, dir[2])));
      // shortest wrap for yaw
      let dy = toYaw - this.yaw;
      while (dy > Math.PI) dy -= TAU;
      while (dy < -Math.PI) dy += TAU;
      const to = [
        b.pos[0] - dir[0] * 38,
        b.pos[1] - dir[1] * 38,
        b.pos[2] - dir[2] * 38,
      ];
      this.warp = {
        mode: "aim",
        target: b,
        from: this.cam.slice(),
        to,
        fromYaw: this.yaw,
        fromPitch: this.pitch,
        toYaw: this.yaw + dy,
        toPitch,
        start: performance.now(),
        aimDur: this.reduced ? 200 : 900,
        warpDur: this.reduced ? 350 : 2400,
        t: 0,
        quiet: !!quiet,
      };
      this.arrivedId = null;
      emit("cosmos:select", { id, quiet: !!quiet });
    }
    goHome(quiet) {
      if (this.noGL) {
        this.arrivedId = null;
        emit("cosmos:home", {});
        return;
      }
      if (this.warp.mode === "warp" || this.warp.mode === "aim") return;
      if (Math.hypot(this.cam[0], this.cam[1], this.cam[2]) < 1) return;
      const b = {
        e: { id: "__home", ly: 0 },
        pos: [0, 0, 0],
        dir: raDecToDir(52, -10),
      };
      const dir = [-this.cam[0], -this.cam[1], -this.cam[2]];
      const dl = Math.hypot(dir[0], dir[1], dir[2]);
      dir[0] /= dl;
      dir[1] /= dl;
      dir[2] /= dl;
      const toYaw = Math.atan2(dir[1], dir[0]);
      const toPitch = Math.asin(Math.max(-1, Math.min(1, dir[2])));
      let dy = toYaw - this.yaw;
      while (dy > Math.PI) dy -= TAU;
      while (dy < -Math.PI) dy += TAU;
      this.warp = {
        mode: "aim",
        target: b,
        from: this.cam.slice(),
        to: [0, 0, 0],
        fromYaw: this.yaw,
        fromPitch: this.pitch,
        toYaw: this.yaw + dy,
        toPitch,
        start: performance.now(),
        aimDur: this.reduced ? 200 : 700,
        warpDur: this.reduced ? 350 : 2000,
        t: 0,
        home: true,
        quiet: !!quiet,
      };
      this.arrivedId = null;
    }
    setStations(list) {
      // decoupled nav stations: independent sky coordinates, travelable like bodies
      this.stations = list.map((s) => {
        const dir = raDecToDir(s.ra, s.dec);
        const depth = 420;
        return {
          e: { id: s.id, ly: s.ly || 0 },
          dir,
          pos: [dir[0] * depth, dir[1] * depth, dir[2] * depth],
          depth,
          sx: -1,
          sy: -1,
          ex: null,
          ey: null,
          vis: false,
        };
      });
    }
    randomBody() {
      if (!this.bodies.length) return;
      const b = this.bodies[Math.floor(Math.random() * this.bodies.length)];
      this.travelTo(b.e.id);
    }

    /* ---------- Milky Way: procedural integrated-starlight map (J2000 galactic frame) ---------- */
    _buildMilkyWay() {
      const W2 = 1024,
        H2 = 512;
      const px = new Uint8Array(W2 * H2 * 4);
      const aG = 192.859508 * D2R,
        dG = 27.128336 * D2R,
        lN = 122.932 * D2R; // NGP + node (J2000)
      const sdG = Math.sin(dG),
        cdG = Math.cos(dG);
      const hash = (x, y) => {
        const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return s - Math.floor(s);
      };
      const vnoise = (x, y) => {
        const xi = Math.floor(x),
          yi = Math.floor(y),
          xf = x - xi,
          yf = y - yi;
        const u = xf * xf * (3 - 2 * xf),
          v = yf * yf * (3 - 2 * yf);
        return (
          hash(xi, yi) * (1 - u) * (1 - v) +
          hash(xi + 1, yi) * u * (1 - v) +
          hash(xi, yi + 1) * (1 - u) * v +
          hash(xi + 1, yi + 1) * u * v
        );
      };
      const fbm = (x, y) =>
        0.55 * vnoise(x, y) +
        0.28 * vnoise(x * 2.13, y * 2.13) +
        0.17 * vnoise(x * 4.41, y * 4.41);
      let row = 0;
      const step = () => {
        const end = Math.min(H2, row + 20);
        for (; row < end; row++) {
          const dec = (0.5 - (row + 0.5) / H2) * Math.PI;
          const sd = Math.sin(dec),
            cd = Math.cos(dec);
          for (let i = 0; i < W2; i++) {
            const ra = ((i + 0.5) / W2) * TAU - Math.PI;
            const dra = ra - aG;
            const sb = sd * sdG + cd * cdG * Math.cos(dra);
            const b = Math.asin(Math.max(-1, Math.min(1, sb))) / D2R;
            let l =
              (lN -
                Math.atan2(
                  cd * Math.sin(dra),
                  sd * cdG - cd * sdG * Math.cos(dra),
                )) /
              D2R;
            l = ((l % 360) + 360) % 360;
            const lc = l > 180 ? l - 360 : l; // 0 = galactic centre (Sagittarius)
            // thin+thick disc glow: scale height flares toward the bulge, brightness falls with |l|
            const sig = 6.0 + 9.0 * Math.exp(-(lc * lc) / 9800);
            let band =
              Math.exp(-(b * b) / (2 * sig * sig)) *
              (0.3 + 0.7 * Math.exp(-Math.abs(lc) / 95));
            band *= 0.52 + 0.75 * fbm(l * 0.05, b * 0.09); // patchy star clouds
            const rb = lc * lc * 0.5 + b * b * 2.6;
            const bulge = 1.25 * Math.exp(-rb / 220);
            // bright star clouds: Cygnus, Carina, Scutum
            const cloud =
              0.5 *
                Math.exp(
                  -(((lc - 79) * (lc - 79)) / 90 + ((b - 1) * (b - 1)) / 14),
                ) +
              0.45 *
                Math.exp(
                  -(((lc + 73) * (lc + 73)) / 110 + ((b + 1) * (b + 1)) / 12),
                ) +
              0.5 *
                Math.exp(
                  -(((lc - 27) * (lc - 27)) / 55 + ((b + 2) * (b + 2)) / 16),
                );
            // Great Rift: ridged-noise dust lanes hugging the plane between Cygnus and the centre
            const rEnv =
              Math.exp(-(b * b) / 42) *
              Math.exp(-((lc - 35) * (lc - 35)) / 5400);
            const ridge = 1 - Math.abs(2 * fbm(l * 0.11 + 7.3, b * 0.23) - 1);
            const dust =
              Math.max(0, Math.min(1, ridge * ridge * 1.5 - 0.28)) * rEnv;
            const coal =
              0.85 *
              Math.exp(
                -(((lc + 57) * (lc + 57)) / 26 + ((b + 1.5) * (b + 1.5)) / 9),
              ); // Coalsack
            let I =
              (band * (1 + cloud) + bulge) *
              (1 - 0.82 * Math.min(1, dust + coal));
            I = Math.max(0, I);
            const warm = Math.min(
              1,
              bulge * 0.9 + Math.exp(-Math.abs(lc) / 60) * 0.55,
            );
            const tone = (x) =>
              Math.round(255 * Math.min(1, 1 - Math.exp(-x * 1.6)));
            const o = (row * W2 + i) * 4;
            px[o] = tone(I * (0.62 + 0.38 * warm) * 0.3);
            px[o + 1] = tone(I * (0.66 + 0.24 * warm) * 0.3);
            px[o + 2] = tone(I * (0.88 - 0.2 * warm) * 0.34);
            px[o + 3] = 255;
          }
        }
        if (row < H2) {
          setTimeout(step, 0);
          return;
        }
        this._bandU8 = px; // kept for context-restore
        this._uploadBand();
      };
      step();
    }
    _uploadBand() {
      const gl = this.gl;
      if (!gl || !this._bandU8) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1024,
        512,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._bandU8,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.bandTex = tex;
      this._bandFade = 0;
    }
    /* ---------- keyboard access ---------- */
    _bindKeys() {
      this.tabIndex = 0;
      this.setAttribute("role", "application");
      this.setAttribute(
        "aria-label",
        "Interactive star chart. Arrow keys look around, Enter travels to the target nearest screen centre, H returns home.",
      );
      // Focus outline lives in global.css (space-engine:focus-visible) rather than being
      // injected here as an inline <style>, so it is compatible with the hash-based CSP.
      this.addEventListener("keydown", (e) => {
        if (this.noGL) return;
        const k = e.key;
        if (k === "ArrowLeft") {
          this.velYaw = Math.max(-0.03, this.velYaw - 0.006);
        } else if (k === "ArrowRight") {
          this.velYaw = Math.min(0.03, this.velYaw + 0.006);
        } else if (k === "ArrowUp") {
          this.velPitch = Math.min(0.02, this.velPitch + 0.004);
        } else if (k === "ArrowDown") {
          this.velPitch = Math.max(-0.02, this.velPitch - 0.004);
        } else if (k === "Enter") {
          if (this.hoverId) {
            this.travelTo(this.hoverId);
          } else {
            let best = null,
              bd = 1e9;
            const cxp = (this.clientWidth || innerWidth) / 2,
              cyp = (this.clientHeight || innerHeight) / 2;
            for (const b of this.bodies.concat(this.stations)) {
              if (!b.vis) continue;
              const d2 =
                (b.sx - cxp) * (b.sx - cxp) + (b.sy - cyp) * (b.sy - cyp);
              if (d2 < bd) {
                bd = d2;
                best = b;
              }
            }
            if (best) this.travelTo(best.e.id);
          }
        } else if (k === "h" || k === "H") {
          this.goHome();
        } else return;
        e.preventDefault();
      });
    }
    /* ---------- no-WebGL fallback: static CSS sky, navigation still functional ---------- */
    _domFallback() {
      this.noGL = true;
      this.style.background =
        "radial-gradient(ellipse at 60% 20%, #0b1030 0%, #05081a 55%, #030512 100%)";
      const stars = document.createElement("div");
      const sh = [];
      for (let i = 0; i < 240; i++) {
        const x = (Math.random() * 100).toFixed(2),
          y = (Math.random() * 100).toFixed(2);
        const a = (0.25 + Math.random() * 0.75).toFixed(2);
        sh.push(
          x +
            "vw " +
            y +
            "vh 0 " +
            (Math.random() < 0.12 ? "1px" : "0") +
            " rgba(232,234,246," +
            a +
            ")",
        );
      }
      Object.assign(stars.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "1px",
        height: "1px",
        borderRadius: "50%",
        boxShadow: sh.join(","),
      });
      this.appendChild(stars);
      const band = document.createElement("div");
      Object.assign(band.style, {
        position: "absolute",
        inset: "-20%",
        background:
          "linear-gradient(115deg, transparent 38%, rgba(158,170,230,0.10) 47%, rgba(232,224,205,0.16) 50%, rgba(158,170,230,0.10) 53%, transparent 62%)",
        filter: "blur(6px)",
        pointerEvents: "none",
      });
      this.appendChild(band);
      setTimeout(() => {
        emit("cosmos:progress", { loaded: 200000, total: 200000 });
        emit("cosmos:ready", {});
      }, 60);
    }
    /* ---------- GPU context restore: recompile + re-upload from CPU-side copies ---------- */
    _rebuildGL() {
      const gl = this.gl;
      if (!gl) return;
      this.pStar = compile(gl, STAR_VS, STAR_FS);
      this.pTrail = compile(gl, TRAIL_VS, TRAIL_FS);
      this.pFlat = compile(gl, FLAT_VS, FLAT_FS);
      this.pPhoto = compile(gl, PHOTO_VS, PHOTO_FS);
      this.pBand = compile(gl, BAND_VS, BAND_FS);
      this.pPlume = compile(gl, PLUME_VS, PLUME_FS);
      const gp = this.pPhoto;
      gp.aCenter = gl.getAttribLocation(gp.prog, "aCenter");
      gp.aCorner = gl.getAttribLocation(gp.prog, "aCorner");
      gp.aLocal = gl.getAttribLocation(gp.prog, "aLocal");
      gp.aCell = gl.getAttribLocation(gp.prog, "aCell");
      gp.aMisc2 = gl.getAttribLocation(gp.prog, "aMisc");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this.buf = {
        stars: gl.createBuffer(),
        trails: gl.createBuffer(),
        bodies: gl.createBuffer(),
        con: gl.createBuffer(),
        ship: gl.createBuffer(),
        glow: gl.createBuffer(),
        photo: gl.createBuffer(),
        band: gl.createBuffer(),
        plume: gl.createBuffer(),
      };
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.band);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      if (this.fieldF) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.stars);
        gl.bufferData(gl.ARRAY_BUFFER, this.fieldF.buffer, gl.STATIC_DRAW);
        this.loaded = this.total;
        const N = this.total,
          nT = Math.floor(N / 3);
        const trl = new ArrayBuffer(nT * 32),
          tf = new Float32Array(trl),
          tb = new Uint8Array(trl);
        const pf = this.fieldF,
          pb = this.fieldB;
        for (let i = 0; i < N; i += 3) {
          const ti = (i / 3) | 0;
          for (let e2 = 0; e2 < 2; e2++) {
            const tfo = ti * 8 + e2 * 4,
              tbo = ti * 32 + e2 * 16;
            tf[tfo] = pf[i * 4];
            tf[tfo + 1] = pf[i * 4 + 1];
            tf[tfo + 2] = pf[i * 4 + 2];
            tb[tbo + 12] = pb[i * 16 + 12];
            tb[tbo + 13] = pb[i * 16 + 13];
            tb[tbo + 14] = pb[i * 16 + 14];
            tb[tbo + 15] = e2 * 255;
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.trails);
        gl.bufferData(gl.ARRAY_BUFFER, trl, gl.STATIC_DRAW);
        this.nTrail = nT * 2;
      }
      this._uploadBand();
      if (window.CELESTIAL) {
        this._applyImgmap();
        this._buildBodies();
        this._buildConstellations();
      }
      this.atlasTex = null;
      this._atlasStarted = false;
      this._atlasMap = null;
      this._buildAtlas();
      this._dyn = null;
      this._photoFade = 0;
      this._loadShip();
      // craft after context restore: re-upload if we have one; if a previous
      // load failed (possibly DUE to the context loss), retry from scratch.
      if (this.craft) this.craft.upload(gl);
      else if (this.craftTier !== "off") {
        this._craftLoading = null;
        this._loadCraft();
      }
      this._kick();
    }

    /* ---------- frame ---------- */
    _tick(now) {
      const gl = this.gl;
      if (!gl || this._ctxLost) return;
      this._frame++;
      // throttle to half rate when scrolled far below hero and idle
      const scrolled = (window.scrollY || 0) > innerHeight * 1.6;
      if (scrolled && this.warp.mode === "idle" && this._frame % 2) return;
      // adaptive quality governor: demote on sustained slow frames, promote when comfortably fast
      if (this._lastT) {
        const dt = now - this._lastT;
        if (dt > 0 && dt < 200) {
          this._ft = this._ft * 0.9 + dt * 0.1;
          const budget = scrolled ? 42 : 25;
          if (this._ft > budget) {
            this._ftGood = 0;
            if (++this._ftBad > 70 && this.tier > 0) {
              this.tier--;
              this._ftBad = 0;
              this._ft = 16;
            }
          } else if (this._ft < 15) {
            this._ftBad = 0;
            if (++this._ftGood > 900 && this.tier < 2) {
              this.tier++;
              this._ftGood = 0;
            }
          }
        }
      }
      this._lastT = now;

      const t = now * 0.001;
      // inertia
      if (!this.reduced) {
        this.yaw += this.velYaw;
        this.pitch = Math.max(
          -1.45,
          Math.min(1.45, this.pitch + this.velPitch),
        );
        this.velYaw *= 0.94;
        this.velPitch *= 0.94;
      }
      // slow ambient drift when idle at home
      if (
        this.warp.mode === "idle" &&
        !this.reduced &&
        Math.hypot(...this.cam) < 1
      )
        this.yaw += 0.00012;

      // warp state machine
      const w = this.warp;
      if (w.mode === "aim") {
        const k = Math.min(1, (now - w.start) / w.aimDur);
        const e = ease(k);
        this.yaw = w.fromYaw + (w.toYaw - w.fromYaw) * e;
        this.pitch = w.fromPitch + (w.toPitch - w.fromPitch) * e;
        if (k >= 1) {
          w.mode = "warp";
          w.start = now;
        }
      } else if (w.mode === "warp") {
        const k = Math.min(1, (now - w.start) / w.warpDur);
        const e = ease(k);
        w.t = k;
        for (let i = 0; i < 3; i++)
          this.cam[i] = w.from[i] + (w.to[i] - w.from[i]) * e;
        // brachistochrone profile: constant burn to midpoint, flip, constant deceleration burn
        const dsdk = k < 0.5 ? 4 * k : 4 * (1 - k);
        this._beta = Math.min(0.88, 0.88 * dsdk * 0.5);
        const dwx = w.to[0] - w.from[0],
          dwy = w.to[1] - w.from[1],
          dwz = w.to[2] - w.from[2];
        const dwl = Math.hypot(dwx, dwy, dwz) || 1;
        this._warpDir = [dwx / dwl, dwy / dwl, dwz / dwl];
        const phase = k < 0.47 ? "accel" : k < 0.53 ? "flip" : "decel";
        const flipT = k < 0.47 ? 0 : k < 0.53 ? (k - 0.47) / 0.06 : 1;
        this._shipFlip += (flipT - this._shipFlip) * 0.25;
        const lyTotal = w.home ? 0 : w.target.e.ly || 0;
        const vC =
          lyTotal > 0 ? (lyTotal * dsdk) / (w.warpDur / 1000) / 3.1688e-8 : 0;
        emit("cosmos:warp", {
          id: w.target.e.id,
          t: k,
          ly: lyTotal * (1 - e),
          vC,
          phase,
          home: !!w.home,
          quiet: !!w.quiet,
        });
        if (k >= 1) {
          w.mode = "idle";
          if (w.home) {
            this.arrivedId = null;
            emit("cosmos:home", {});
          } else {
            this.arrivedId = w.target.e.id;
            emit("cosmos:arrive", { id: w.target.e.id, quiet: !!w.quiet });
          }
        }
      }
      if (w.mode !== "warp") {
        this._beta *= 0.86;
        if (this._beta < 0.004) this._beta = 0;
        this._shipFlip *= 0.9;
        if (this._shipFlip < 0.01) this._shipFlip = 0;
      }
      const beta = this.reduced ? 0 : this._beta;
      const gamma = 1 / Math.sqrt(1 - beta * beta);
      // trailing camera for streaks
      const lag = this.reduced ? 1 : 0.1;
      for (let i = 0; i < 3; i++)
        this.camPrev[i] += (this.cam[i] - this.camPrev[i]) * lag;
      const warpSpeed = Math.hypot(
        this.cam[0] - this.camPrev[0],
        this.cam[1] - this.camPrev[1],
        this.cam[2] - this.camPrev[2],
      );

      // aim readout (throttled)
      if (this._frame % 8 === 0) {
        let ra = (this.yaw / D2R) % 360;
        if (ra < 0) ra += 360;
        emit("cosmos:aim", { ra, dec: this.pitch / D2R, warp: w.mode });
      }

      /* render */
      const W = this.canvas.width,
        H = this.canvas.height;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.003, 0.004, 0.012, 1); // vacuum black
      gl.clear(gl.COLOR_BUFFER_BIT);
      const dir = [
        Math.cos(this.pitch) * Math.cos(this.yaw),
        Math.cos(this.pitch) * Math.sin(this.yaw),
        Math.sin(this.pitch),
      ];
      const proj = persp(70 * D2R * (1 + warpSpeed * 0.004), W / H, 0.1, 6000);
      const view = viewFrom(dir);

      // Milky Way diffuse band (integrated starlight + dust) — drawn first, behind everything
      if (this.bandTex) {
        this._bandFade = Math.min(1, (this._bandFade || 0) + 0.012);
        const P = this.pBand;
        gl.useProgram(P.prog);
        gl.uniform3f(P.u.uRight, view[0], view[4], view[8]);
        gl.uniform3f(P.u.uUp, view[1], view[5], view[9]);
        gl.uniform3f(P.u.uFwd, dir[0], dir[1], dir[2]);
        gl.uniform1f(P.u.uTanY, Math.tan(35 * D2R * (1 + warpSpeed * 0.004)));
        gl.uniform1f(P.u.uAspect, W / H);
        gl.uniform1f(
          P.u.uFade,
          this._bandFade *
            (this.tier === 2 ? 0.95 : this.tier === 1 ? 0.8 : 0.65),
        );
        if (P.u.uBeta) {
          gl.uniform1f(P.u.uBeta, beta);
          gl.uniform1f(P.u.uGamma, gamma);
          gl.uniform3fv(P.u.uWarpDir, this._warpDir);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.bandTex);
        gl.uniform1i(P.u.uTex, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.band);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 2, gl.FLOAT, false, 8, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // background stars
      const drawN = Math.min(
        this.loaded,
        Math.floor(
          this.total *
            this.density *
            (this.tier === 2 ? 1 : this.tier === 1 ? 0.72 : 0.5),
        ),
      );
      if (drawN > 0) {
        const P = this.pStar;
        gl.useProgram(P.prog);
        gl.uniformMatrix4fv(P.u.uProj, false, proj);
        gl.uniformMatrix4fv(P.u.uView, false, view);
        gl.uniform3fv(P.u.uCam, this.cam);
        gl.uniform1f(P.u.uTime, t);
        gl.uniform1f(P.u.uSize, this.dpr);
        gl.uniform1f(P.u.uMode, 0);
        gl.uniform1f(P.u.uPulse, 1);
        gl.uniform1f(
          P.u.uHaloAmp,
          this.tier === 2 ? 1 : this.tier === 1 ? 0.55 : 0,
        );
        gl.uniform1f(P.u.uBeta, beta);
        gl.uniform1f(P.u.uGamma, gamma);
        gl.uniform3fv(P.u.uWarpDir, this._warpDir);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.stars);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(P.aMeta);
        gl.vertexAttribPointer(P.aMeta, 4, gl.UNSIGNED_BYTE, true, 16, 12);
        gl.drawArrays(gl.POINTS, 0, drawN);
      }
      // warp trails
      if (warpSpeed > 0.4 && this.nTrail && !this.reduced && this.tier > 0) {
        const P = this.pTrail;
        gl.useProgram(P.prog);
        gl.uniformMatrix4fv(P.u.uProj, false, proj);
        gl.uniformMatrix4fv(P.u.uView, false, view);
        gl.uniform3fv(P.u.uCam, this.cam);
        gl.uniform3fv(P.u.uCamPrev, this.camPrev);
        if (P.u.uBeta) {
          gl.uniform1f(P.u.uBeta, beta);
          gl.uniform3fv(P.u.uWarpDir, this._warpDir);
        }
        gl.uniform1f(P.u.uWarp, Math.min(1, warpSpeed * 0.06));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.trails);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(P.aMeta);
        gl.vertexAttribPointer(P.aMeta, 4, gl.UNSIGNED_BYTE, true, 16, 12);
        gl.drawArrays(gl.LINES, 0, this.nTrail);
      }
      // constellation figures
      if (this.showCon && this.nCon) {
        const P = this.pFlat;
        gl.useProgram(P.prog);
        const mv = mul(proj, view);
        // translate by -cam: bake into matrix
        const T = [
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          -this.cam[0],
          -this.cam[1],
          -this.cam[2],
          1,
        ];
        gl.uniformMatrix4fv(P.u.uMVP, false, mul(mv, T));
        gl.uniform4f(P.u.uColor, 0.55, 0.61, 0.88, 0.34 * (1 - beta)); // figures fade during relativistic transit
        gl.uniform1f(P.u.uRound, 0);
        gl.uniform1f(P.u.uPtSize, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.con);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 12, 0);
        if (P.aMeta >= 0) gl.disableVertexAttribArray(P.aMeta);
        gl.drawArrays(gl.LINES, 0, this.nCon);
      }
      // photographic bodies: real imagery billboards + textured globes
      if (this.nPhoto && this.atlasTex) {
        this._photoFade = Math.min(1, (this._photoFade || 0) + 0.02);
        const P = this.pPhoto;
        gl.useProgram(P.prog);
        gl.uniformMatrix4fv(P.u.uProj, false, proj);
        gl.uniformMatrix4fv(P.u.uView, false, view);
        gl.uniform3fv(P.u.uCam, this.cam);
        gl.uniform2f(P.u.uVp, W, H);
        gl.uniform1f(P.u.uTime, t);
        gl.uniform1f(P.u.uFade, this._photoFade);
        if (P.u.uBeta) {
          gl.uniform1f(P.u.uBeta, beta);
          gl.uniform3fv(P.u.uWarpDir, this._warpDir);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
        gl.uniform1i(P.u.uTex, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.photo);
        const S = 60;
        gl.enableVertexAttribArray(P.aCenter);
        gl.vertexAttribPointer(P.aCenter, 3, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(P.aCorner);
        gl.vertexAttribPointer(P.aCorner, 2, gl.FLOAT, false, S, 12);
        gl.enableVertexAttribArray(P.aLocal);
        gl.vertexAttribPointer(P.aLocal, 2, gl.FLOAT, false, S, 20);
        gl.enableVertexAttribArray(P.aCell);
        gl.vertexAttribPointer(P.aCell, 4, gl.FLOAT, false, S, 28);
        gl.enableVertexAttribArray(P.aMisc2);
        gl.vertexAttribPointer(P.aMisc2, 4, gl.FLOAT, false, S, 44);
        gl.drawArrays(gl.TRIANGLES, 0, this.nPhoto);
        [P.aCenter, P.aCorner, P.aLocal, P.aCell, P.aMisc2].forEach((loc) => {
          if (loc > 1) gl.disableVertexAttribArray(loc);
        });
      }
      // dynamic close-up billboard for the current warp target (photo bodies without an atlas cell)
      if (this._dyn && this._dyn.tex) {
        const dyn = this._dyn;
        const bd =
          dyn.bd ||
          (dyn.bd = this.bodies.find((x) => x.e.id === dyn.id) || null);
        if (bd && (!this._atlasMap || !this._atlasMap[dyn.id])) {
          dyn.fade = Math.min(1, dyn.fade + 0.025);
          const e = bd.e;
          let ty = PHOTO_T[e.t] || 2;
          if (e.t === "cluster") ty = /globular/i.test(e.sp || "") ? 4 : 5;
          const sizeB =
            { common: 60, uncommon: 90, rare: 130, epic: 180, legendary: 235 }[
              e.r
            ] || 90;
          const boost = Math.max(ty === 1 ? 1.5 : 2.6, 2.6);
          const seed = 0.35;
          if (!dyn.verts) {
            const v = new Float32Array(6 * 15);
            const cs = [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, -1],
              [1, 1],
              [-1, 1],
            ];
            let k = 0;
            for (const q of cs) {
              v[k++] = bd.pos[0];
              v[k++] = bd.pos[1];
              v[k++] = bd.pos[2];
              v[k++] = q[0];
              v[k++] = q[1];
              v[k++] = q[0];
              v[k++] = q[1];
              v[k++] = 0;
              v[k++] = 0;
              v[k++] = 1;
              v[k++] = 1;
              v[k++] = sizeB;
              v[k++] = ty;
              v[k++] = seed;
              v[k++] = boost;
            }
            dyn.verts = v;
          }
          const P2 = this.pPhoto;
          gl.useProgram(P2.prog);
          gl.uniformMatrix4fv(P2.u.uProj, false, proj);
          gl.uniformMatrix4fv(P2.u.uView, false, view);
          gl.uniform3fv(P2.u.uCam, this.cam);
          gl.uniform2f(P2.u.uVp, W, H);
          gl.uniform1f(P2.u.uTime, t);
          gl.uniform1f(P2.u.uFade, dyn.fade);
          if (P2.u.uBeta) {
            gl.uniform1f(P2.u.uBeta, beta);
            gl.uniform3fv(P2.u.uWarpDir, this._warpDir);
          }
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dyn.tex);
          gl.uniform1i(P2.u.uTex, 0);
          if (!this.buf.dyn) this.buf.dyn = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.dyn);
          gl.bufferData(gl.ARRAY_BUFFER, dyn.verts, gl.DYNAMIC_DRAW);
          const S2 = 60;
          gl.enableVertexAttribArray(P2.aCenter);
          gl.vertexAttribPointer(P2.aCenter, 3, gl.FLOAT, false, S2, 0);
          gl.enableVertexAttribArray(P2.aCorner);
          gl.vertexAttribPointer(P2.aCorner, 2, gl.FLOAT, false, S2, 12);
          gl.enableVertexAttribArray(P2.aLocal);
          gl.vertexAttribPointer(P2.aLocal, 2, gl.FLOAT, false, S2, 20);
          gl.enableVertexAttribArray(P2.aCell);
          gl.vertexAttribPointer(P2.aCell, 4, gl.FLOAT, false, S2, 28);
          gl.enableVertexAttribArray(P2.aMisc2);
          gl.vertexAttribPointer(P2.aMisc2, 4, gl.FLOAT, false, S2, 44);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          [P2.aCenter, P2.aCorner, P2.aLocal, P2.aCell, P2.aMisc2].forEach(
            (loc) => {
              if (loc > 1) gl.disableVertexAttribArray(loc);
            },
          );
        }
      }
      // curated bodies
      if (this.nBodies) {
        const P = this.pStar;
        gl.useProgram(P.prog);
        gl.uniformMatrix4fv(P.u.uProj, false, proj);
        gl.uniformMatrix4fv(P.u.uView, false, view);
        gl.uniform3fv(P.u.uCam, this.cam);
        gl.uniform1f(P.u.uTime, t);
        gl.uniform1f(P.u.uSize, this.dpr);
        gl.uniform1f(P.u.uMode, 1);
        gl.uniform1f(P.u.uPulse, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.bodies);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(P.aMeta);
        gl.vertexAttribPointer(P.aMeta, 4, gl.UNSIGNED_BYTE, true, 16, 12);
        gl.drawArrays(gl.POINTS, 0, this.nBodies);
        this._projectBodies(proj, view, W, H);
      }
      // ship
      if (this.showShip && (this.nShip || (this.craft && this.craft.ready)))
        this._drawShip(t, warpSpeed, W, H);
    }
    _projectBodies(proj, view, W, H) {
      const pv = mul(proj, view);
      const rectW = W / this.dpr,
        rectH = H / this.dpr;
      const m = 76; // edge margin for off-view markers
      const all = this.stations.length
        ? this.bodies.concat(this.stations)
        : this.bodies;
      for (const b of all) {
        const x = b.pos[0] - this.cam[0],
          y = b.pos[1] - this.cam[1],
          z = b.pos[2] - this.cam[2];
        const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
        let inView = false;
        if (cw > 0.01) {
          const cx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / cw;
          const cy = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / cw;
          inView = cx > -1.1 && cx < 1.1 && cy > -1.1 && cy < 1.1;
          b.sx = (cx * 0.5 + 0.5) * rectW;
          b.sy = (-cy * 0.5 + 0.5) * rectH;
        }
        b.vis = inView;
        if (inView) {
          b.ex = b.sx;
          b.ey = b.sy;
        } else {
          // clamp to the screen edge along the direction toward the body (off-view marker)
          const rp = view[0] * x + view[4] * y + view[8] * z;
          const up = view[1] * x + view[5] * y + view[9] * z;
          const ang = Math.atan2(up, rp);
          b.ex = rectW / 2 + Math.cos(ang) * (rectW / 2 - m);
          b.ey = rectH / 2 - Math.sin(ang) * (rectH / 2 - m);
        }
      }
    }
    _drawShip(t, warpSpeed, W, H) {
      const gl = this.gl,
        P = this.pFlat;
      // glide between flight stations: hero top-center → parked at visited body → corner escort when scrolled
      const sh = this.ship;
      const sy = window.scrollY || 0;
      let tx, ty, ts, ta;
      if (sy > innerHeight * 0.55) {
        // corner escort while reading page content (modest 1.5× bump)
        tx = 0.72;
        ty = -0.6;
        ts = 0.4;
        ta = 0.42;
      } else if (this.arrivedId) {
        // parked at a body (2× bump — featured under the dossier)
        tx = 0;
        ty = -0.16;
        ts = 0.72;
        ta = 0.58;
      } else {
        // hero: center stage at 2.5× (owner sign-off 2026-07-17, TR-020) —
        // ty 0.20 lands the ship at screen center once SHIP_NDC_Y_OFFSET folds in
        tx = 0;
        ty = 0.2;
        ts = 1.125;
        ta = 0.52;
      }
      // P2 flight dynamics: springs toward the station targets (overshoot +
      // settle = perceptible mass), with look-lag so the ship trails view
      // rotation like a real near object. Reduced motion snaps directly.
      const dt = this._shipT
        ? Math.min(SHIP_MAX_DT, Math.max(0, t - this._shipT))
        : 1 / 60;
      this._shipT = t;
      if (this.reduced) {
        sh.x = tx;
        sh.y = ty;
        this._shipVel.x = 0;
        this._shipVel.y = 0;
      } else {
        const lagX = this.velYaw * SHIP_LAG_YAW;
        const lagY = -this.velPitch * SHIP_LAG_PITCH;
        const spx = { p: sh.x, v: this._shipVel.x };
        springStep(spx, tx + lagX, dt, SHIP_SPRING_OMEGA, SHIP_SPRING_ZETA);
        sh.x = spx.p;
        this._shipVel.x = spx.v;
        const spy = { p: sh.y, v: this._shipVel.y };
        springStep(spy, ty + lagY, dt, SHIP_SPRING_OMEGA, SHIP_SPRING_ZETA);
        sh.y = spy.p;
        this._shipVel.y = spy.v;
      }
      const kk = this.reduced ? 1 : 0.055;
      sh.s += (ts - sh.s) * kk;
      sh.a += (ta - sh.a) * kk;
      const fade = sh.a;
      const aspect = W / H;
      // model: obj is nose -Z (blender export) — pitch it up-screen, view from behind-above
      const bobNdc = this.reduced ? 0 : Math.sin(t * 1.4) * SHIP_BOB_NDC;
      const wk = this.warp.mode === "warp" ? this.warp.t : -1;
      const burning = wk >= 0 && (wk < 0.47 || wk > 0.53);
      const bank = Math.max(
        -0.5,
        Math.min(
          0.5,
          -this.velYaw * 30 -
            this._shipVel.x * 0.5 +
            (burning ? Math.sin(t * 30) * 0.022 : 0),
        ),
      );
      const cA = Math.cos(bank),
        sA = Math.sin(bank);
      const pitch = -0.42 + (this.warp.mode === "warp" ? -0.06 : 0);
      const cP = Math.cos(pitch),
        sP = Math.sin(pitch);
      // column-major: scale * rotX(pitch) * rotY(flip-and-burn) * rotZ(bank)
      const fA = Math.PI * this._shipFlip;
      const cY = Math.cos(fA),
        sY = Math.sin(fA);
      const ry = [cY, 0, -sY, 0, 0, 1, 0, 0, sY, 0, cY, 0, 0, 0, 0, 1];
      const rz = [cA, sA, 0, 0, -sA, cA, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const rx = [1, 0, 0, 0, 0, cP, sP, 0, 0, -sP, cP, 0, 0, 0, 0, 1];
      const rot = mul(rx, mul(ry, rz));
      const S = sh.s * shipScaleFactor();
      let m = rot.map((v) => v * S);
      m[15] = 1;
      // P2 placement: a real view-space object under the scene projection
      // (same FOV formula as _tick, so warp speed makes the whole camera —
      // ship included — breathe), not a clip-space post-shift.
      const fovY = 70 * D2R * (1 + warpSpeed * 0.004);
      const proj = persp(fovY, aspect, 0.1, 6000);
      const [vpx, vpy, vpz] = ndcToView(
        sh.x,
        sh.y + SHIP_NDC_Y_OFFSET + bobNdc,
        SHIP_VIEW_DEPTH,
        SHIP_BASE_FOV,
        aspect,
      );
      const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, vpx, vpy, vpz, 1];
      const mvp = mul(proj, mul(T, m));
      // P3 arrival presence: rim light warms toward beacon-gold while parked
      // at a body, cools back in flight. Reduced motion snaps.
      const parked = !!this.arrivedId && this.warp.mode === "idle";
      this._rimK +=
        ((parked ? 1 : 0) - this._rimK) * (this.reduced ? 1 : 0.045);
      if (this.craft && this.craft.ready) {
        // ship-v2 textured craft: identical placement chain, textured triangles
        // instead of gold lines (craft-loader handles its own depth/blend state).
        this.craft.draw(gl, mvp, rot, fade, rimColorAt(this._rimK));
      } else {
        gl.useProgram(P.prog);
        gl.uniformMatrix4fv(P.u.uMVP, false, mvp);
        gl.uniform4f(P.u.uColor, 1.0, 0.835, 0.31, fade); // gold wireframe
        gl.uniform1f(P.u.uRound, 0);
        gl.uniform1f(P.u.uPtSize, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.ship);
        gl.enableVertexAttribArray(P.aPos);
        gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 12, 0);
        if (P.aMeta >= 0) gl.disableVertexAttribArray(P.aMeta);
        gl.drawArrays(gl.LINES, 0, this.nShip);
      }
      // P3 layered exhaust: phase-driven cone plumes (ship-dynamics.ts builds
      // the crossed-quad geometry; additive blending is already active).
      const coasting = this.warp.mode === "warp" && !burning;
      const plumeP = {
        burning,
        coasting,
        parked,
        reduced: this.reduced,
        t,
      };
      const pp = this.pPlume;
      gl.useProgram(pp.prog);
      gl.uniformMatrix4fv(pp.u.uMVP, false, mvp);
      gl.uniform1f(pp.u.uAlpha, plumeAlpha(plumeP) * fade);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.plume);
      if (!this._plumeVerts) this._plumeVerts = buildPlumeVertices(0);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        buildPlumeVertices(plumeFlareLength(plumeP), this._plumeVerts),
        gl.DYNAMIC_DRAW,
      );
      gl.enableVertexAttribArray(pp.aPos);
      gl.vertexAttribPointer(pp.aPos, 4, gl.FLOAT, false, 16, 0);
      if (pp.aMeta >= 0) gl.disableVertexAttribArray(pp.aMeta);
      gl.drawArrays(gl.TRIANGLES, 0, PLUME_VERTEX_COUNT);
      // engine glow points — the hot nozzle cores (both ship paths)
      gl.useProgram(P.prog);
      gl.uniformMatrix4fv(P.u.uMVP, false, mvp);
      const glowA = burning
        ? 1.0
        : this.warp.mode === "warp"
          ? 0.16
          : 0.35 + 0.1 * Math.sin(t * 3);
      const g = new Float32Array([
        0, -0.09, 0.28, -0.05, -0.07, 0.24, 0.05, -0.07, 0.24,
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.glow);
      gl.bufferData(gl.ARRAY_BUFFER, g, gl.DYNAMIC_DRAW);
      // enable explicitly: the craft path disables all its attrib arrays, so
      // this pass must not depend on the wireframe path's leftover state
      // (latent since P1 — glow points were degenerate with the craft on).
      gl.enableVertexAttribArray(P.aPos);
      gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, 12, 0);
      gl.uniform4f(P.u.uColor, 1.0, 0.7, 0.25, glowA * fade);
      gl.uniform1f(P.u.uRound, 1);
      gl.uniform1f(
        P.u.uPtSize,
        (burning ? 30 : this.warp.mode === "warp" ? 10 : 14) * this.dpr,
      );
      gl.drawArrays(gl.POINTS, 0, 3);
    }
  }
  if (!customElements.get("space-engine"))
    customElements.define("space-engine", SpaceEngine);
})();
