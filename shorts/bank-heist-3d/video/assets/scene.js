// 3D cutaway diorama for "은행 터는 법" — every frame is a pure function of t (seconds).
import * as THREE from "./vendor/three.module.js";

const W = 1080, H = 1920;
const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);

// ---------- helpers ----------
const mats = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...opts });
  return mats[key];
}
function box(w, h, d, color, x, y, z, parent = scene, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
// box from min/max corners
function boxMM(x0, y0, z0, x1, y1, z1, color, parent = scene, opts) {
  return box(x1 - x0, y1 - y0, z1 - z0, color, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent, opts);
}
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
function textTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
function plane(w, h, tex, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.position.set(x, y, z); parent.add(m); return m;
}

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b4a2b, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(7, 14, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -10, near: 1, far: 50 });
sun.shadow.bias = -0.0005;
scene.add(sun);
const vaultLight = new THREE.PointLight(0xffc46b, 10, 9, 2);
vaultLight.position.set(0, -1.6, -1.2);
scene.add(vaultLight);
const spot = new THREE.SpotLight(0xfff0d0, 0, 14, 0.42, 0.6, 1.5);
spot.position.set(0, 9.5, 1.5);
spot.target.position.set(0, 4.2, -2.5);
scene.add(spot); scene.add(spot.target);

const SKY = new THREE.Color(0x9cc6ea), NIGHT = new THREE.Color(0x0c1020), WARM = new THREE.Color(0xffd79a);
scene.background = SKY.clone();

// ---------- ground with soil cross-section ----------
const SOIL = [0x6e4a2c, 0x8a5a33, 0x9c4f2b, 0x7d3f24];
function soil(x0, y0, z0, x1, y1, z1) {
  const bands = [[-0.7, 0], [-3.6, -0.7], [-9, -3.6], [-17, -9]];
  bands.forEach(([b0, b1], i) => {
    const a = Math.max(y0, b0), b = Math.min(y1, b1);
    if (b > a) boxMM(x0, a, z0, x1, b, z1, SOIL[i]);
  });
}
const GX0 = -9, GX1 = 10, GZ0 = -5.5, GZ1 = 1.6, GY0 = -16;
soil(GX0, GY0, GZ0, -2, 0, GZ1);            // left of vault
soil(2, GY0, GZ0, GX1, 0, GZ1);             // right of vault
soil(-2, GY0, GZ0, 2, -4, GZ1);             // below vault
soil(-2, -1, GZ0, 2, 0, GZ1);               // above vault
soil(-2, -4, GZ0, 2, -1, -4);               // behind vault
boxMM(GX0, 0, GZ0, GX1, 0.08, GZ1, 0x6fae4f); // grass
boxMM(GX0, 0.08, -1.7, -3, 0.1, -0.3, 0x5a5d66); // path to door
// stones in the soil face
{
  const r = mulberry32(11);
  for (let i = 0; i < 44; i++) {
    const x = lerp(GX0 + 0.5, GX1 - 0.5, r()), y = lerp(-12, -0.9, r());
    if (x > -2.3 && x < 2.3 && y > -4.3 && y < -0.7) continue;
    if (y > -2.95 && y < -2.05 && x > 1.8 && x < 7.4) continue;
    const s = 0.12 + r() * 0.22;
    box(s * 1.6, s, 0.1, i % 3 ? 0x5c3c22 : 0xb08860, x, y, GZ1 + 0.03);
  }
}

// ---------- vault (underground) ----------
boxMM(-2, -4, -4, 2, -3.85, GZ1 - 0.02, 0x7d8590);       // floor
boxMM(-2, -4, -4, 2, -1, -3.9, 0x8f97a2);               // back wall
boxMM(-2.02, -4, -4, -1.9, -1, GZ1 - 0.02, 0x7a828d);   // left wall
boxMM(1.9, -4, -4, 2.02, -1, GZ1 - 0.02, 0x7a828d);     // right wall
boxMM(-2, -1.12, -4, 2, -1, GZ1 - 0.02, 0x6c737d);      // ceiling
// shelves with money and gold
function moneyBundle(parent) {
  const g = new THREE.Group();
  box(0.5, 0.18, 0.26, 0x4f9a55, 0, 0, 0, g);
  box(0.1, 0.19, 0.27, 0xf2efe6, 0, 0, 0, g);
  parent.add(g); return g;
}
for (let s = 0; s < 3; s++) {
  const y = -3.85 + 0.75 * s + 0.5;
  boxMM(-1.7, y - 0.06, -3.85, 1.7, y, -3.1, 0x5b4632);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 2 + ((i + s) % 2); k++) {
      if ((i + s) % 4 === 3) { box(0.42, 0.14, 0.2, 0xf2c14e, -1.4 + i * 0.56, y + 0.07 + k * 0.15, -3.45, scene, { metalness: 0.6, roughness: 0.35 }); }
      else { const b = moneyBundle(scene); b.position.set(-1.4 + i * 0.56, y + 0.1 + k * 0.19, -3.45); }
    }
  }
}
// floor piles of cash + gold
{
  const r = mulberry32(5);
  for (let i = 0; i < 14; i++) {
    const b = moneyBundle(scene);
    b.position.set(lerp(-1.6, 1.4, r()), -3.75 + Math.floor(i / 7) * 0.19, lerp(-2.6, 0.6, r()));
    b.rotation.y = r() * 3;
  }
}
// round vault door, swung open against the left wall
const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 28), mat(0xa9b0b9, { metalness: 0.7, roughness: 0.35 }));
vaultDoor.rotation.z = Math.PI / 2; vaultDoor.position.set(-1.75, -2.45, -0.6); vaultDoor.castShadow = true;
scene.add(vaultDoor);
for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(0.06, 0.5, 0.06, 0x6b7179, -1.6, -2.45 + Math.sin(a) * 0.25, -0.6 + Math.cos(a) * 0.25, scene).rotation.x = a; }

// ---------- pipe from vault to the house ----------
const pipeMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.33, roughness: 0.2, metalness: 0.1, depthWrite: false });
const PIPE_Y = -2.5, PIPE_X1 = 6.75, PIPE_Z = GZ1 - 0.05;
{
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, PIPE_X1 - 1.9, 20, 1, true), pipeMat);
  h.rotation.z = Math.PI / 2; h.position.set((1.9 + PIPE_X1) / 2, PIPE_Y, PIPE_Z); scene.add(h);
  const v = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.9, 20, 1, true), pipeMat);
  v.position.set(PIPE_X1, PIPE_Y + 1.45, PIPE_Z); scene.add(v);
  // dug channel behind the pipe
  boxMM(1.95, PIPE_Y - 0.42, PIPE_Z - 0.5, PIPE_X1 + 0.42, PIPE_Y + 0.42, PIPE_Z - 0.38, 0x3e2716);
  boxMM(PIPE_X1 - 0.42, PIPE_Y, PIPE_Z - 0.5, PIPE_X1 + 0.42, 0.02, PIPE_Z - 0.38, 0x3e2716);
  // brass rings
  for (const x of [2.6, 4.2, 5.8]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 20), mat(0xc9a24a, { metalness: 0.6, roughness: 0.4 })); ring.rotation.y = Math.PI / 2; ring.position.set(x, PIPE_Y, PIPE_Z); scene.add(ring); }
}
const PIPE_PATH = [[1.6, PIPE_Y], [PIPE_X1, PIPE_Y], [PIPE_X1, 0.6]];
const PIPE_LEN = (PIPE_X1 - 1.6) + (0.6 - PIPE_Y);
function pipePoint(s) {
  let d = s * PIPE_LEN; const seg = PIPE_X1 - 1.6;
  if (d <= seg) return [1.6 + d, PIPE_Y];
  return [PIPE_X1, PIPE_Y + (d - seg)];
}
const flowBundles = [];
for (let i = 0; i < 8; i++) { const b = moneyBundle(scene); b.visible = false; flowBundles.push(b); }

// ---------- the worker's house ----------
const house = new THREE.Group(); scene.add(house);
boxMM(5.6, 0.08, -2.6, 8.0, 2.2, -0.2, 0xf3e6cf, house);
const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 2.8, 3), mat(0xc0563f));
roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2 * 0; roof.position.set(6.8, 2.95, -1.4); roof.scale.set(1, 1, 0.82); roof.castShadow = true;
roof.rotation.set(0, 0, Math.PI / 2); roof.rotation.y = 0;
house.add(roof);
boxMM(6.45, 0.1, -0.22, 7.15, 1.5, -0.12, 0x7b4a2a, house); // door
boxMM(5.85, 1.0, -0.22, 6.3, 1.6, -0.12, 0xa9d6f5, house);  // window
boxMM(7.35, 1.0, -0.22, 7.8, 1.6, -0.12, 0xa9d6f5, house);
const pileBundles = [];
for (let i = 0; i < 18; i++) { const b = moneyBundle(scene); b.position.set(7.7 + (i % 3) * 0.0 + (Math.floor(i / 3) % 2) * 0.55, 0.18 + Math.floor(i / 6) * 0.19, 0.3 + (i % 3) * 0.3); b.rotation.y = 1.57; b.visible = false; pileBundles.push(b); }
const houseSign = plane(1.4, 0.45, textTexture(512, 160, (g, w, h) => { g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d2433"; g.font = "900 96px Pretendard"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("우리집", w / 2, h / 2 + 6); }), 6.8, 1.85, -0.11);

// ---------- trees ----------
{
  const r = mulberry32(3);
  const spots = [[-8.2, -4.4], [-6.6, -4.9], [-5.0, -4.3], [-8.5, -2.3], [4.2, -4.6], [5.4, -4.9], [8.8, -4.3], [9.3, -2.2], [-6.1, -3.2], [3.7, -3.0]];
  spots.forEach(([x, z]) => {
    const s = 0.8 + r() * 0.5;
    box(0.25 * s, 1.2 * s, 0.25 * s, 0x6b4a2b, x, 0.6 * s, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.0 * s, 7), mat(r() > 0.5 ? 0x3f8f4a : 0x4fa357));
    c.position.set(x, 2.0 * s, z); c.castShadow = true; scene.add(c);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 1.5 * s, 7), c.material);
    c2.position.set(x, 2.8 * s, z); c2.castShadow = true; scene.add(c2);
  });
  for (let i = 0; i < 18; i++) { const x = lerp(GX0 + 0.3, GX1 - 0.3, r()), z = lerp(-5.2, 1.2, r()); if (x > -3.4 && x < 3.4) continue; if (x > 5.3 && x < 8.4 && z > -2.9) continue; if (z > -1.9 && z < -0.1 && x < -3) continue; box(0.3, 0.12, 0.3, 0x4c8d3c, x, 0.14, z); }
}

// ---------- the bank ----------
const BX0 = -3, BX1 = 3, BZ0 = -4, BZ1 = 0.8;
boxMM(BX0, 0.08, BZ0, BX1, 0.22, BZ1, 0xd9cdb5);                 // lobby floor
for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) if ((i + k) % 2) boxMM(BX0 + i, 0.221, BZ0 + k * 1.2, BX0 + i + 1, 0.226, BZ0 + (k + 1) * 1.2, 0xc8b99c);
boxMM(BX0, 0.08, BZ0, BX1, 6.4, BZ0 + 0.2, 0xf1e7d3);              // back wall
boxMM(BX1 - 0.2, 0.08, BZ0, BX1, 6.4, BZ1, 0xe8dcc4);              // right wall
boxMM(BX0, 0.08, BZ0, BX0 + 0.2, 6.4, -1.6, 0xe8dcc4);             // left wall (behind door)
boxMM(BX0, 0.08, -0.4, BX0 + 0.2, 6.4, BZ1, 0xe8dcc4);             // left wall (front of door)
boxMM(BX0, 2.3, -1.6, BX0 + 0.2, 6.4, -0.4, 0xe8dcc4);             // over the door
boxMM(BX0, 3.1, BZ0, BX1, 3.32, BZ1, 0xcdbf9f);                    // 2F floor
boxMM(BX0, 3.32, BZ0, BX1, 3.36, BZ1, 0xb98d5e);                   // 2F wood floor
boxMM(BX0 - 0.15, 6.4, BZ0 - 0.15, BX1 + 0.15, 6.7, BZ1 + 0.15, 0xc9b994); // roof slab
boxMM(BX0 - 0.15, 6.7, BZ1 - 0.2, BX1 + 0.15, 7.6, BZ1 + 0.15, 0x24324f);  // sign board
plane(5.6, 0.8, textTexture(1024, 150, (g, w, h) => { g.fillStyle = "#24324f"; g.fillRect(0, 0, w, h); g.fillStyle = "#f4c542"; g.font = "900 104px Pretendard"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BANK  은행", w / 2, h / 2 + 6); }), 0, 7.15, BZ1 + 0.16);
for (const x of [BX0 + 0.12, BX1 - 0.12]) box(0.32, 6.2, 0.32, 0xfaf3e3, x, 3.2, BZ1 - 0.1);
// windows on the back walls
for (const [x, y] of [[-1.6, 1.9], [1.8, 2.1], [-1.6, 5.0], [1.9, 5.3]]) { if (x > 1 && y > 4) continue; boxMM(x - 0.6, y - 0.55, BZ0 + 0.2, x + 0.6, y + 0.55, BZ0 + 0.24, 0xa9d6f5); }
// door on a hinge
const doorPivot = new THREE.Group(); doorPivot.position.set(BX0 + 0.1, 0.22, -1.6); scene.add(doorPivot);
boxMM(-0.05, 0, 0, 0.05, 2.06, 1.18, 0x7b4a2a, doorPivot);
box(0.12, 0.08, 0.08, 0xf2c14e, 0.09, 1.0, 1.0, doorPivot);
// counter
boxMM(-0.4, 0.22, -2.4, 2.7, 1.25, -1.85, 0x8b5a34);
boxMM(-0.5, 1.25, -2.5, 2.8, 1.33, -1.75, 0x5a3a22);
box(0.5, 0.35, 0.05, 0x22262e, 1.9, 1.5, -2.25); // teller monitor
// rope stanchions
for (const x of [-1.6, -0.6]) { box(0.08, 0.9, 0.08, 0xc9a24a, x, 0.67, -0.2); box(0.24, 0.05, 0.24, 0xc9a24a, x, 0.25, -0.2); }
boxMM(-1.6, 0.98, -0.23, -0.6, 1.03, -0.17, 0xb03030);
// 2F office: desk, laptop, chair, calendar, plant
boxMM(-1.1, 4.0, -2.05, 1.1, 4.1, -1.35, 0x8b5a34);
for (const [x, z] of [[-1.0, -1.45], [1.0, -1.45], [-1.0, -1.95], [1.0, -1.95]]) boxMM(x - 0.04, 3.36, z - 0.04, x + 0.04, 4.0, z + 0.04, 0x5a3a22);
const laptop = new THREE.Group(); laptop.position.set(-0.55, 4.1, -1.75); scene.add(laptop);
box(0.62, 0.03, 0.42, 0x9aa3ad, 0, 0.015, 0, laptop);
const lid = new THREE.Group(); lid.position.set(0, 0.03, 0.2); laptop.add(lid);
box(0.62, 0.42, 0.03, 0x9aa3ad, 0, 0.21, 0, lid); lid.rotation.x = 0.25;
boxMM(-0.5, 3.36, -3.15, 0.5, 3.85, -2.75, 0x2b2f38); // chair seat back area
boxMM(-0.45, 3.85, -3.2, 0.45, 4.7, -3.08, 0x2b2f38);
const examPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: textTexture(256, 340, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d2433"; g.font = "900 44px Pretendard"; g.textAlign = "center"; g.fillText("입사시험", w / 2, 60); g.fillStyle = "#c9c2b5"; for (let i = 0; i < 6; i++) g.fillRect(24, 100 + i * 36, w - 48, 8); g.fillStyle = "#e3262d"; g.font = "900 60px Pretendard"; g.fillText("100", w - 60, h - 26); }) }));
examPaper.rotation.x = -Math.PI / 2; examPaper.position.set(0.35, 4.106, -1.7); scene.add(examPaper);
const calTex = [];
for (let m = 1; m <= 12; m++) calTex.push(textTexture(256, 300, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#e3262d"; g.fillRect(0, 0, w, 80); g.fillStyle = "#fff"; g.font = "900 54px Pretendard"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("월급날", w / 2, 42); g.fillStyle = "#1d2433"; g.font = "900 150px Pretendard"; g.fillText(m + "월", w / 2, 190); g.fillStyle = "#e3262d"; g.font = "900 40px Pretendard"; g.fillText("25일 ●", w / 2, 272); }));
const calendar = plane(0.85, 1.0, calTex[0], 1.6, 5.05, BZ0 + 0.22);
const plant = new THREE.Group(); plant.position.set(2.3, 3.36, -3.3); scene.add(plant);
box(0.4, 0.45, 0.4, 0xc0563f, 0, 0.22, 0, plant);
{ const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0x3f8f4a)); c.position.y = 0.8; c.castShadow = true; plant.add(c); }

// ---------- characters ----------
function person({ shirt, pants, skin = 0xf0c8a0, hair = 0x3a2a1e, hat = null, tie = null, bun = false }) {
  const root = new THREE.Group(); scene.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.88; root.add(hips);
  const legs = [-0.12, 0.12].map((x) => { const p = new THREE.Group(); p.position.set(x, 0, 0); hips.add(p); box(0.2, 0.86, 0.22, pants, 0, -0.43, 0, p); box(0.22, 0.1, 0.3, 0x222222, 0, -0.84, 0.04, p); return p; });
  const torso = new THREE.Group(); hips.add(torso);
  box(0.52, 0.66, 0.3, shirt, 0, 0.33, 0, torso);
  if (tie) { box(0.16, 0.5, 0.02, 0xffffff, 0, 0.38, 0.155, torso); box(0.07, 0.42, 0.02, tie, 0, 0.36, 0.17, torso); }
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  box(0.4, 0.4, 0.38, skin, 0, 0.22, 0, head);
  box(0.06, 0.08, 0.02, 0x111111, -0.09, 0.25, 0.195, head); box(0.06, 0.08, 0.02, 0x111111, 0.09, 0.25, 0.195, head);
  const mouth = box(0.12, 0.03, 0.02, 0x8a3b2e, 0, 0.12, 0.195, head);
  if (hat) { box(0.44, 0.2, 0.42, hat, 0, 0.44, 0, head); box(0.44, 0.06, 0.06, hat, 0, 0.36, 0.2, head); }
  else { box(0.42, 0.12, 0.4, hair, 0, 0.44, -0.01, head); box(0.42, 0.24, 0.08, hair, 0, 0.3, -0.18, head); }
  if (bun) box(0.18, 0.18, 0.18, hair, 0, 0.5, -0.22, head);
  const arms = [-0.34, 0.34].map((x) => { const p = new THREE.Group(); p.position.set(x, 0.6, 0); torso.add(p); box(0.15, 0.62, 0.17, shirt, 0, -0.29, 0, p); box(0.14, 0.12, 0.15, skin, 0, -0.63, 0, p); return p; });
  return { root, hips, legs, arms, torso, head, mouth };
}
function walk(p, phase, amt = 1) {
  const s = Math.sin(phase) * 0.6 * amt;
  p.legs[0].rotation.x = s; p.legs[1].rotation.x = -s;
  p.arms[0].rotation.x = -s * 0.8; p.arms[1].rotation.x = s * 0.8;
  p.hips.position.y = 0.88 + Math.abs(Math.cos(phase)) * 0.04 * amt;
}
function pose(p) { p.legs.forEach((l) => l.rotation.set(0, 0, 0)); p.arms.forEach((a) => a.rotation.set(0, 0, 0)); p.hips.position.y = 0.88; p.head.rotation.set(0, 0, 0); p.torso.rotation.set(0, 0, 0); }

const robber = person({ shirt: 0x23252b, pants: 0x1a1b1f, hat: 0x111216, skin: 0xe9bf98 });
box(0.3, 0.08, 0.24, 0x111216, 0, 0.27, 0.12, robber.head); // mask band over the eyes area
const gun = new THREE.Group(); robber.arms[1].add(gun); gun.position.set(0, -0.68, 0.05);
box(0.08, 0.12, 0.34, 0x3a3d44, 0, 0, 0.12, gun); box(0.07, 0.18, 0.08, 0x3a3d44, 0, -0.1, 0.0, gun);
const teller = person({ shirt: 0x3f6fb5, pants: 0x2b2f38, hair: 0x2a1b12, bun: true });
const worker = person({ shirt: 0x2a3550, pants: 0x232a3d, hair: 0x2a1b12, tie: 0xc0392b });
const police = person({ shirt: 0x2f4f8f, pants: 0x1f2f55, hat: 0x1f2f55 });
box(0.12, 0.1, 0.02, 0xf2c14e, -0.12, 0.5, 0.16, police.torso);

// ---------- confetti ----------
const confetti = [];
{
  const r = mulberry32(42); const cols = [0xe3262d, 0xf4c542, 0x4f9a55, 0x3f6fb5, 0xffffff];
  for (let i = 0; i < 140; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.15), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
    m.userData = { x: lerp(-3.2, 3.2, r()), z: lerp(-3, 1.5, r()), y0: lerp(6.5, 10.5, r()), v: lerp(1.2, 2.4, r()), sp: lerp(2, 7, r()), ph: r() * 6 };
    m.visible = false; scene.add(m); confetti.push(m);
  }
}

// ---------- camera keys: [t, pos, target] ----------
const K = [
  [0.0, [0.6, 2.2, 31], [0.6, 5.2, -1]],
  [1.95, [0.6, 2.0, 28.5], [0.6, 4.9, -1]],
  [1.99, [-5.2, 2.0, 9.5], [-2.8, 1.2, -1]],      // cut: street + door
  [3.9, [-4.4, 2.0, 8.6], [-2.4, 1.2, -1]],
  [4.6, [-0.4, 2.1, 7.8], [0.2, 1.2, -1.6]],      // into the lobby
  [8.26, [-0.2, 2.1, 7.3], [0.2, 1.2, -1.6]],
  [9.7, [0.0, -2.2, 7.6], [0.0, -2.5, -2.0]],     // dive to the vault
  [11.42, [0.0, -2.3, 6.8], [0.0, -2.5, -2.0]],
  [11.43, [0.4, 4.9, 6.6], [0.0, 4.05, -2.2]],    // cut: 2F office
  [15.3, [0.2, 4.8, 6.0], [0.0, 4.1, -2.2]],
  [16.1, [1.0, 5.0, 4.6], [1.4, 4.75, -3.2]],     // calendar
  [18.9, [0.9, 5.0, 4.3], [1.4, 4.75, -3.2]],
  [19.06, [0.2, 4.8, 5.6], [0.0, 4.1, -2.2]],
  [23.9, [0.1, 4.8, 5.3], [0.0, 4.1, -2.2]],
  [25.1, [4.2, -0.2, 19.5], [4.2, -0.9, -1]],     // pipe to the house
  [27.09, [4.3, -0.1, 18.6], [4.3, -0.9, -1]],
  [28.6, [0.6, 2.2, 29], [0.6, 1.2, -1]],         // wide
  [33.71, [0.6, 2.2, 28], [0.6, 1.2, -1]],
  [37.3, [0.0, 4.75, 3.2], [0.0, 4.55, -2.6]],    // push to the worker
  [37.4, [0.0, 5.1, 5.9], [0.0, 5.55, -2.4]],      // cut: celebration
  [41.5, [0.0, 5.1, 5.3], [0.0, 5.55, -2.4]],
];
function cameraAt(t) {
  let i = 0; while (i < K.length - 1 && t >= K[i + 1][0]) i++;
  const a = K[i], b = K[Math.min(i + 1, K.length - 1)];
  const k = b === a ? 0 : smooth((t - a[0]) / (b[0] - a[0]));
  const p = a[1].map((v, j) => lerp(v, b[1][j], k)), q = a[2].map((v, j) => lerp(v, b[2][j], k));
  camera.position.set(...p); camera.lookAt(...q);
}

// ---------- the frame at t ----------
const TOTAL = 41.5;
export function renderAt(t) {
  t = clamp(t, 0, TOTAL);
  cameraAt(t);

  // lighting mood
  const dark = ramp(t, 33.8, 35.2) * (1 - ramp(t, 37.38, 37.42));
  const warm = ramp(t, 37.38, 37.6);
  hemi.intensity = lerp(1.6, 0.12, dark) + warm * 0.4;
  sun.intensity = lerp(2.6, 0.1, dark) + warm * 0.4;
  spot.intensity = dark * 80;
  scene.background.copy(SKY).lerp(NIGHT, dark).lerp(WARM, warm * 0.85);
  vaultLight.intensity = 10 + 22 * ramp(t, 8.3, 9.6) * (1 - ramp(t, 11.2, 11.5)) + Math.sin(t * 9) * 1.5;

  // robber (0 – 8.26)
  robber.root.visible = t < 8.26;
  pose(robber);
  if (t < 2.4) { robber.root.position.set(-7.2, 0.1, -1); robber.root.rotation.y = Math.PI / 2; robber.head.rotation.y = Math.sin(t * 3) * 0.4; }
  else if (t < 3.45) { const k = (t - 2.4) / (3.45 - 2.4); robber.root.position.set(lerp(-7.2, -3.7, k), 0.1, -1); robber.root.rotation.y = Math.PI / 2; walk(robber, t * 11); }
  else if (t < 3.75) { robber.root.position.set(-3.7, 0.1, -1); robber.root.rotation.y = Math.PI / 2; robber.arms[1].rotation.x = -1.3; }
  else if (t < 4.45) { const k = (t - 3.75) / (4.45 - 3.75); robber.root.position.set(lerp(-3.7, -1.0, k), 0.22, lerp(-1, -0.9, k)); robber.root.rotation.y = lerp(Math.PI / 2, 2.2, k); walk(robber, t * 11); }
  else { robber.root.position.set(-1.0, 0.22, -0.9); robber.root.rotation.y = 2.2; }
  const aim = ramp(t, 4.45, 4.7);
  robber.arms[1].rotation.x = t >= 4.45 ? -1.55 * aim : robber.arms[1].rotation.x;
  gun.visible = t >= 4.45;
  if (t > 5.8) robber.root.position.x += Math.sin(t * 30) * 0.01;
  doorPivot.rotation.y = -1.6 * ramp(t, 3.45, 3.85);

  // teller
  pose(teller);
  teller.root.position.set(1.2, 0.22, -2.95); teller.root.rotation.y = 0;
  teller.root.visible = t < 11.43 || t >= 27.09;
  const up = ramp(t, 5.8, 6.05) * (t < 8.26 ? 1 : 0);
  teller.arms[0].rotation.x = -2.9 * up; teller.arms[1].rotation.x = -2.9 * up;
  teller.arms[0].rotation.z = -0.2 * up; teller.arms[1].rotation.z = 0.2 * up;
  if (up > 0) teller.root.position.x += Math.sin(t * 40) * 0.012 * up;
  if (t < 4.4) teller.head.rotation.y = Math.sin(t * 1.3) * 0.2;
  teller.mouth.scale.y = up > 0 ? 4 : 1;

  // worker (11.43 – end): seated at the 2F desk, facing the camera
  worker.root.visible = t >= 11.43;
  pose(worker);
  const celebrate = ramp(t, 37.6, 37.9);
  worker.root.position.set(0, 3.36 + 0.0, -2.6); worker.root.rotation.y = 0;
  if (celebrate <= 0) {
    worker.hips.position.y = 0.5; worker.legs.forEach((l) => (l.rotation.x = -1.45));
    worker.arms.forEach((a) => (a.rotation.x = -1.1));
    if (t >= 12.2 && t < 13.25) { worker.arms[1].rotation.x = -1.2 + Math.sin(t * 22) * 0.12; worker.head.rotation.x = 0.35; }     // writing the exam
    if (t >= 13.3 && t < 14.5) { worker.arms[0].rotation.x = -1.15 + Math.sin(t * 26) * 0.1; worker.arms[1].rotation.x = -1.15 + Math.cos(t * 26) * 0.1; } // typing
    if (t >= 14.5 && t < 15.4) { worker.head.rotation.y = Math.sin((t - 14.5) * 9) * 0.7; }                                    // looking around
    if (t >= 27 && t < 33.7) { worker.arms.forEach((a, i) => (a.rotation.x = -1.15 + Math.sin(t * 20 + i) * 0.08)); }
    if (t >= 33.7) { worker.head.rotation.x = -0.12; worker.mouth.scale.x = 1.6; }                                            // smug
  } else {
    worker.hips.position.y = lerp(0.5, 0.88 + Math.abs(Math.sin(t * 8)) * 0.15, celebrate);
    worker.legs.forEach((l) => (l.rotation.x = lerp(-1.45, 0, celebrate)));
    worker.root.position.z = lerp(-2.6, -2.45, celebrate);
    worker.arms[0].rotation.x = -2.8 * celebrate; worker.arms[1].rotation.x = -2.8 * celebrate;
    worker.arms[0].rotation.z = -0.35 * celebrate + Math.sin(t * 8) * 0.15; worker.arms[1].rotation.z = 0.35 * celebrate - Math.sin(t * 8) * 0.15;
    worker.mouth.scale.set(1.8, 4, 1);
  }
  examPaper.visible = t >= 11.43 && t < 15.4;

  // calendar flips on "한 달마다"
  const month = t < 15.4 ? 0 : Math.min(11, Math.floor((t - 15.4) / 0.24));
  calendar.material.map = calTex[month];

  // money flowing through the pipe to the house (24.1 – 34.5), one bundle every 0.9 s
  const FLOW0 = 24.1, PERIOD = 0.9, TRAVEL = 2.2;
  let arrived = 0;
  flowBundles.forEach((b) => (b.visible = false));
  for (let n = 0; n < 40; n++) {
    const t0 = FLOW0 + n * PERIOD; if (t0 > 34.5) break;
    const s = (t - t0) / TRAVEL;
    if (s >= 1) { arrived++; continue; }
    if (s < 0) continue;
    const b = flowBundles[n % flowBundles.length];
    const [x, y] = pipePoint(s);
    b.visible = true; b.position.set(x, y, PIPE_Z); b.rotation.set(0, 0, s * 9 + n);
  }
  pileBundles.forEach((b, i) => (b.visible = i < Math.min(arrived, pileBundles.length)));

  // police strolling past without noticing (28.4 – 33.7)
  police.root.visible = t >= 28.4 && t < 33.71;
  pose(police);
  if (police.root.visible) {
    const k = clamp((t - 28.4) / 4.2, 0, 1);
    police.root.position.set(lerp(-8.4, -4.0, k), 0.1, 0.6); police.root.rotation.y = Math.PI / 2;
    if (k < 1) walk(police, t * 10); else { police.root.rotation.y = 0.4; }
    if (t > 30.0 && t < 31.6) { police.arms[1].rotation.x = -2.6; police.arms[1].rotation.z = Math.sin(t * 14) * 0.3; police.root.rotation.y = 0.6; }
  }

  // confetti on the reveal
  confetti.forEach((m) => {
    const u = m.userData, dt = t - 37.45;
    m.visible = dt > 0;
    if (!m.visible) return;
    const y = u.y0 - u.v * dt;
    if (y > 3.38) { m.position.set(u.x + Math.sin(dt * 2 + u.ph) * 0.25, y, u.z); m.rotation.set(dt * u.sp, dt * u.sp * 0.7 + u.ph, 0); }
    else { m.position.set(u.x + Math.sin((u.y0 - 3.38) / u.v * 2 + u.ph) * 0.25, 3.38, u.z); m.rotation.set(-Math.PI / 2, 0, u.ph); } // landed
  });

  renderer.render(scene, camera);
}
