import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const sceneHost = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b121b);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, -12);
camera.up.set(1, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x0b121b, 1);
renderer.domElement.style.display = 'block';
sceneHost.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xaac3d8, 0x111722, 1.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2); keyLight.position.set(4, 6, 8); scene.add(keyLight);
const grid = new THREE.GridHelper(16, 16, 0x263b4e, 0x172635); grid.position.y = -3.25; scene.add(grid);

// Camera convention: +Y is screen-right, +X is screen-up, and +Z goes into
// the screen. Keep the displayed geometry in the same handed coordinate frame.
const displayRoot = new THREE.Group();
scene.add(displayRoot);
const group = new THREE.Group(); displayRoot.add(group);
const mirrorSize = 9.5;
const mirrorMaterialA = new THREE.MeshPhysicalMaterial({ color: 0x6fd8e2, transparent: true, opacity: .2, metalness: .7, roughness: .18, side: THREE.DoubleSide });
const mirrorMaterialB = new THREE.MeshPhysicalMaterial({ color: 0x9d86f5, transparent: true, opacity: .18, metalness: .65, roughness: .2, side: THREE.DoubleSide });
const mirrorA = new THREE.Mesh(new THREE.PlaneGeometry(mirrorSize, mirrorSize), mirrorMaterialA);
const mirrorB = new THREE.Mesh(new THREE.PlaneGeometry(mirrorSize, mirrorSize), mirrorMaterialB);
// Base planes share the X axis. Their normals are (Y+Z)/sqrt(2) and (Y-Z)/sqrt(2).
const zNormal = new THREE.Vector3(0, 0, 1);
const baseNormals = [new THREE.Vector3(0, 1, 1).normalize(), new THREE.Vector3(0, 1, -1).normalize()];
mirrorA.quaternion.setFromUnitVectors(zNormal, baseNormals[0]);
mirrorB.quaternion.setFromUnitVectors(zNormal, baseNormals[1]);
group.add(mirrorA, mirrorB);
const edge = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 8.8, 12), new THREE.MeshBasicMaterial({ color: 0xe9f2fa }));
edge.rotation.z = Math.PI / 2; group.add(edge);

const axis = new THREE.AxesHelper(2.1); axis.material.transparent = true; axis.material.opacity = .7; displayRoot.add(axis);
const rayGroup = new THREE.Group(); displayRoot.add(rayGroup);
const rayMats = [new THREE.LineBasicMaterial({ color: 0xa9b8c8, depthTest: false, depthWrite: false }), new THREE.LineBasicMaterial({ color: 0xffb75e, depthTest: false, depthWrite: false }), new THREE.LineBasicMaterial({ color: 0x67e8c0, depthTest: false, depthWrite: false })];
const arrowMats = [new THREE.MeshBasicMaterial({ color: 0xa9b8c8, depthTest: false, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0xffb75e, depthTest: false, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0x67e8c0, depthTest: false, depthWrite: false })];
const rayLines = rayMats.map((mat) => { const line = new THREE.Line(new THREE.BufferGeometry(), mat); rayGroup.add(line); return line; });
rayGroup.renderOrder = 10;
const hitMarkers = [0,1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 8), new THREE.MeshBasicMaterial({color:0xffffff})); rayGroup.add(m); return m; });
const arrows = arrowMats.map((mat) => { const a = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), .7, mat.color, .16, .1); rayGroup.add(a); return a; });

const planeBasis = [[new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,1).normalize()], [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,-1).normalize()]];
const rayStart = new THREE.Vector3(1.2, 6, 3);
const baseIncident = new THREE.Vector3(0,-1,0);
const xSlider = document.querySelector('#xSlider'), ySlider = document.querySelector('#ySlider'), zSlider = document.querySelector('#zSlider');
const fmt = (v) => `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(3)}`;
function rotatedData() {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(+xSlider.value), THREE.MathUtils.degToRad(+ySlider.value), THREE.MathUtils.degToRad(+zSlider.value), 'XYZ'));
  return { q, normals: baseNormals.map((n) => n.clone().applyQuaternion(q)), bases: planeBasis.map((bs) => bs.map((b) => b.clone().applyQuaternion(q))) };
}
function rayPlaneHit(origin, direction, normal) {
  const denom = direction.dot(normal); if (Math.abs(denom) < 1e-6) return null;
  const t = -origin.dot(normal) / denom; return t > 1e-5 ? origin.clone().addScaledVector(direction, t) : null;
}
function withinMirror(point, index, data) { const rel = point; return Math.abs(rel.dot(data.bases[index][0])) <= mirrorSize/2 && Math.abs(rel.dot(data.bases[index][1])) <= mirrorSize/2; }
function setSegment(line, a, b) { line.geometry.setFromPoints([a,b]); line.geometry.computeBoundingSphere(); }
function update() {
  const data = rotatedData();
  group.quaternion.copy(data.q);
  let origin = rayStart.clone(), direction = baseIncident.clone();
  const segments = [], hits = [];
  const candidates = data.normals.map((n, i) => { const p = rayPlaneHit(origin, direction, n); return p && withinMirror(p, i, data) ? {i, p} : null; }).filter(Boolean).sort((a,b) => a.p.distanceTo(origin) - b.p.distanceTo(origin));
  for (let bounce=0; bounce<2 && candidates.length; bounce++) {
    const hit = candidates.shift(); hits.push(hit.p.clone());
    segments.push([origin.clone(), hit.p.clone()]);
    direction = direction.clone().sub(data.normals[hit.i].clone().multiplyScalar(2 * direction.dot(data.normals[hit.i]))).normalize();
    origin = hit.p.clone().addScaledVector(direction, .001);
    const nextCandidates = data.normals.map((n, i) => { if (i === hit.i) return null; const p = rayPlaneHit(origin, direction, n); return p && withinMirror(p, i, data) ? {i, p} : null; }).filter(Boolean).sort((a,b) => a.p.distanceTo(origin) - b.p.distanceTo(origin));
    candidates.splice(0, candidates.length, ...nextCandidates);
  }
  segments.push([origin.clone(), origin.clone().addScaledVector(direction, 4.4)]);
  rayLines.forEach((line, i) => setSegment(line, ...segments[i]));
  hitMarkers.forEach((m, i) => { m.visible = Boolean(hits[i]); if (hits[i]) m.position.copy(hits[i]); });
  arrows.forEach((a, i) => { const seg = segments[i]; const d = seg[1].clone().sub(seg[0]); a.position.copy(seg[0].clone().addScaledVector(d, .58)); a.setDirection(d.normalize()); a.setLength(.72, .16, .1); });
  mirrorA.material.opacity = .2; mirrorB.material.opacity = .18;
  document.querySelector('#incidentVector').textContent = `(${fmt(baseIncident.x)}, ${fmt(baseIncident.y)}, ${fmt(baseIncident.z)})`;
  document.querySelector('#outgoingVector').textContent = `(${fmt(direction.x)}, ${fmt(direction.y)}, ${fmt(direction.z)})`;
  document.querySelector('#deviationValue').textContent = `${THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(baseIncident.dot(direction), -1, 1))).toFixed(1)}°`;
  const ok = hits.length === 2; document.querySelector('#statusText').textContent = ok ? '双次反射已成立' : '当前姿态未完成双次反射'; document.querySelector('.status-dot').style.background = ok ? '#5ee0b7' : '#ffb75e';
  ['x','y','z'].forEach((k) => { document.querySelector(`#${k}Value`).textContent = `${document.querySelector(`#${k}Slider`).value}°`; });
  document.querySelector('#rotationSummary').textContent = `${xSlider.value}° / ${ySlider.value}° / ${zSlider.value}°`;
}
function resize() { const w = sceneHost.clientWidth, h = sceneHost.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); }
window.addEventListener('resize', resize); [xSlider,ySlider,zSlider].forEach((el) => { el.addEventListener('input', update); el.addEventListener('change', update); });
document.querySelector('#resetBtn').addEventListener('click', () => { xSlider.value = 0; ySlider.value = 0; zSlider.value = 0; update(); });
resize(); update();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
