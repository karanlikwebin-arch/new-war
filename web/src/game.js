import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#game");
const loading = document.querySelector("#loading");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x89969a);
scene.fog = new THREE.Fog(0x89969a, 25, 68);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 100);
scene.add(camera);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);
const playerRoot = new THREE.Group();
scene.add(playerRoot);

scene.add(new THREE.HemisphereLight(0xc9d7de, 0x4c493b, 2.0));
const sun = new THREE.DirectionalLight(0xffedcf, 2.5);
sun.position.set(-7, 13, -4);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ color: 0x545b4b, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.025;
scene.add(ground);

const grid = new THREE.GridHelper(80, 40, 0x66705b, 0x66705b);
grid.position.y = -0.01;
grid.material.transparent = true;
grid.material.opacity = 0.18;
scene.add(grid);

const blockers = [];
const shotObjects = [];
const effects = [];
const targetMeshes = [];
const playerPosition = playerRoot.position;
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const cameraFocus = new THREE.Vector3();
const cameraDestination = new THREE.Vector3();
const cameraAimDirection = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const traceEnd = new THREE.Vector3();
const ikTarget = new THREE.Vector3();
const ikEffector = new THREE.Vector3();
const ikOrigin = new THREE.Vector3();
const ikCurrent = new THREE.Vector3();
const ikDesired = new THREE.Vector3();
const ikDelta = new THREE.Quaternion();
const ikWorld = new THREE.Quaternion();
const ikParentWorld = new THREE.Quaternion();
const ikLocal = new THREE.Quaternion();
const RELOAD_SECONDS = 1.15;

let soldier = null;
let mixer = null;
let currentAction = null;
let actions = {};
let riflePivot = null;
let cameraWeaponPivot = null;
let cameraWeaponMuzzle = null;
let cameraMuzzleFlash = null;
let cameraMuzzleLight = null;
let muzzleFlash = null;
let muzzleLight = null;
let targetBody = null;
let targetMaterial = null;
let activeWeapon = 0;
const weaponModels = [null, null];
let ammo = 30;
let targetHits = 0;
let score = 0;
let yaw = 0;
let pitch = 0;
let lookPointer = null;
let lastLookX = 0;
let lastLookY = 0;
let joystickPointer = null;
let joyX = 0;
let joyY = 0;
let fireHeld = false;
let aiming = false;
let prone = false;
let jumping = false;
let dead = false;
let jumpVelocity = 0;
let reloadTimer = 0;
let shotTimer = 0;
let flashTimer = 0;
let recoil = 0;
let targetFlash = 0;
let gameReady = false;
let gameStarted = false;
let firstPerson = true;
let audioContext = null;
let leftArmChain = null;

const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x292f2c, metalness: 0.68, roughness: 0.38,
});
const gunDark = new THREE.MeshStandardMaterial({
  color: 0x171b19, metalness: 0.25, roughness: 0.58,
});
const gunWood = new THREE.MeshStandardMaterial({
  color: 0x69472c, metalness: 0.02, roughness: 0.72,
});

function box(parent, name, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radius, length, position, material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 8),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function makeRifle() {
  const gun = new THREE.Group();
  gun.name = "Original_AK_Style_Rifle";
  box(gun, "Receiver", [0.12, 0.13, 0.31], [0, 0, 0], gunMetal);
  box(gun, "Stock", [0.105, 0.11, 0.34], [0, 0.015, -0.31], gunWood);
  box(gun, "Handguard", [0.13, 0.12, 0.24], [0, 0.005, 0.25], gunWood);
  cylinder(gun, "Barrel", 0.021, 0.34, [0, 0.01, 0.53], gunMetal);
  cylinder(gun, "Gas_Tube", 0.017, 0.24, [0, 0.075, 0.23], gunMetal);
  cylinder(gun, "Muzzle", 0.032, 0.055, [0, 0.01, 0.72], gunDark);
  box(gun, "Magazine", [0.095, 0.24, 0.12], [0, -0.17, 0.025], gunDark,
    [-0.12, 0, 0]);
  box(gun, "Pistol_Grip", [0.07, 0.18, 0.085], [0, -0.14, -0.10], gunDark,
    [-0.18, 0, 0]);
  box(gun, "Front_Sight", [0.04, 0.09, 0.025], [0, 0.085, 0.55], gunMetal);
  box(gun, "Rear_Sight", [0.04, 0.055, 0.025], [0, 0.09, 0.05], gunDark);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, 0.76);
  gun.add(muzzle);
  const grip = new THREE.Object3D();
  grip.position.set(0, -0.01, 0.23);
  gun.add(grip);
  return { gun, muzzle, grip };
}

function makeSidearm() {
  const gun = new THREE.Group();
  gun.name = "Original_Service_Sidearm";
  box(gun, "Slide", [0.09, 0.10, 0.27], [0, 0.025, 0.04], gunMetal);
  box(gun, "Frame", [0.09, 0.08, 0.23], [0, -0.035, 0.035], gunDark);
  box(gun, "Grip", [0.075, 0.17, 0.10], [0, -0.14, -0.025], gunDark,
    [-0.20, 0, 0]);
  cylinder(gun, "Barrel", 0.018, 0.11, [0, 0.025, 0.22], gunMetal);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.025, 0.29);
  gun.add(muzzle);
  const grip = new THREE.Object3D();
  grip.position.set(0, -0.01, 0.10);
  gun.add(grip);
  return { gun, muzzle, grip };
}

function createWeapon(rightHand) {
  if (riflePivot?.parent) riflePivot.parent.remove(riflePivot);
  const model = weaponModels[activeWeapon];
  const built = model ? null : activeWeapon === 0 ? makeRifle() : makeSidearm();
  riflePivot = new THREE.Group();
  riflePivot.name = "Weapon_Recoil_Pivot";
  riflePivot.position.set(0.015, -0.035, 0.04);
  riflePivot.rotation.set(0, 0, 0);
  if (model) {
    const gun = new THREE.Group();
    gun.name = activeWeapon === 0 ? "AR70_Model" : "AKM_Model";
    const modelRoot = model.clone(true);
    modelRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(modelRoot);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const rifleLength = 1.05;
    const fitScale = rifleLength / Math.max(size.x, size.y, size.z);
    modelRoot.position.sub(center);
    gun.add(modelRoot);
    gun.rotation.y = -Math.PI / 2;
    gun.scale.setScalar(fitScale);
    gun.position.set(0, -0.08, 0);
    gun.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    riflePivot.add(gun);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.015, rifleLength * 0.52);
    riflePivot.add(muzzle);
    const grip = new THREE.Object3D();
    grip.position.set(0, -0.02, rifleLength * 0.18);
    riflePivot.add(grip);
    riflePivot.userData.muzzle = muzzle;
    riflePivot.userData.grip = grip;
  } else {
    riflePivot.add(built.gun);
    riflePivot.userData.muzzle = built.muzzle;
    riflePivot.userData.grip = built.grip;
  }
  rightHand.add(riflePivot);

  muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, opacity: 0.9 }),
  );
  muzzleFlash.visible = false;
  riflePivot.userData.muzzle.add(muzzleFlash);
  muzzleLight = new THREE.PointLight(0xff9b43, 0, 2.2);
  riflePivot.userData.muzzle.add(muzzleLight);
  riflePivot.visible = !firstPerson;
  createCameraWeapon(model);
}

function createCameraWeapon(model) {
  if (cameraWeaponPivot) camera.remove(cameraWeaponPivot);
  cameraWeaponPivot = new THREE.Group();
  cameraWeaponPivot.position.set(0.22, -0.3, -0.62);
  camera.add(cameraWeaponPivot);

  if (model) {
    const weapon = model.clone(true);
    weapon.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(weapon);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    weapon.position.sub(center);
    weapon.rotation.y = Math.PI / 2;
    weapon.scale.setScalar(0.88 / Math.max(size.x, size.y, size.z));
    weapon.traverse((object) => {
      if (object.isMesh) {
        object.frustumCulled = false;
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    cameraWeaponPivot.add(weapon);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.015, -0.46);
    cameraWeaponMuzzle = muzzle;
    cameraWeaponPivot.add(muzzle);
  } else {
    const fallback = activeWeapon === 0 ? makeRifle() : makeSidearm();
    fallback.gun.rotation.y = Math.PI;
    fallback.gun.scale.setScalar(0.8);
    cameraWeaponPivot.add(fallback.gun);
    cameraWeaponMuzzle = fallback.muzzle;
  }

  const sleeve = new THREE.MeshStandardMaterial({ color: 0x4b5143, roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x77705a, roughness: 0.95 });
  const axis = new THREE.Vector3(0, 1, 0);
  const addForearm = (start, end, radius) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius, length, 10),
      sleeve,
    );
    arm.position.copy(start).add(end).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(axis, direction.normalize());
    cameraWeaponPivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), glove);
    hand.position.copy(end);
    hand.scale.set(1, 0.72, 1.15);
    cameraWeaponPivot.add(hand);
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, 0.065, 10),
      glove,
    );
    cuff.position.copy(end).addScaledVector(direction, -0.035);
    cuff.quaternion.setFromUnitVectors(axis, direction);
    cameraWeaponPivot.add(cuff);
  };
  addForearm(new THREE.Vector3(0.42, -0.78, 0.04), new THREE.Vector3(0.1, -0.13, 0.12), 0.105);
  addForearm(new THREE.Vector3(-0.42, -0.78, -0.02), new THREE.Vector3(-0.1, -0.13, -0.2), 0.1);
  cameraMuzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, opacity: 0.9 }),
  );
  cameraMuzzleFlash.visible = false;
  muzzle.add(cameraMuzzleFlash);
  cameraMuzzleLight = new THREE.PointLight(0xff9b43, 0, 1.8);
  muzzle.add(cameraMuzzleLight);
  cameraWeaponPivot.visible = firstPerson;
}

function setCameraMode(value) {
  firstPerson = value;
  soldier?.traverse((object) => {
    if (object.isMesh) object.visible = !firstPerson;
  });
  if (riflePivot) riflePivot.visible = !firstPerson;
  if (cameraWeaponPivot) cameraWeaponPivot.visible = firstPerson;
  document.querySelector("#camera-first").classList.toggle("active", firstPerson);
  document.querySelector("#camera-third").classList.toggle("active", !firstPerson);
  updateCamera(1);
}

function addObstacle(x, z, width, height, depth, material) {
  const obstacle = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  obstacle.position.set(x, height / 2, z);
  obstacle.material = material;
  scene.add(obstacle);
  blockers.push({ x, z, width: width / 2 + 0.35, depth: depth / 2 + 0.35 });
  shotObjects.push(obstacle);
  return obstacle;
}

function buildTrainingMap() {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x73766d, roughness: 0.92 });
  const crate = new THREE.MeshStandardMaterial({ color: 0x786146, roughness: 0.96 });
  addObstacle(-3.2, 7.5, 2.8, 1.1, 0.65, concrete);
  addObstacle(3.3, 8.5, 2.4, 1.45, 0.7, concrete);
  addObstacle(-5.4, 12, 1.8, 1.4, 1.8, crate);
  addObstacle(5.2, 14, 1.8, 1.0, 1.8, crate);
  addObstacle(0, 23, 18, 2.6, 0.6, concrete);

  const target = new THREE.Group();
  target.position.set(0, 0, 15);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.05, 8),
    gunDark,
  );
  stand.position.y = 0.53;
  target.add(stand);
  targetMaterial = new THREE.MeshStandardMaterial({
    color: 0xa44636, roughness: 0.8, emissive: 0x000000,
  });
  targetBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.16), targetMaterial);
  targetBody.position.y = 1.55;
  targetBody.name = "TrainingTarget";
  target.add(targetBody);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc3b997 }),
  );
  head.position.y = 2.23;
  target.add(head);
  scene.add(target);
  targetMeshes.push(targetBody, head);
  shotObjects.push(targetBody, head);
}

function findClip(name) {
  return gltfAnimations.find((clip) => clip.name.toLowerCase().startsWith(name.toLowerCase()));
}

let gltfAnimations = [];
function playAnimation(name, oneShot = false) {
  if (!mixer || !actions[name]) return;
  const next = actions[name];
  if (currentAction === next && !next.paused) return;
  next.reset();
  next.enabled = true;
  next.paused = false;
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
  next.clampWhenFinished = oneShot;
  next.play();
  if (currentAction && currentAction !== next) currentAction.crossFadeTo(next, 0.22, true);
  currentAction = next;
}

function updateLocomotion() {
  if (dead || jumping || prone || !gameReady) return;
  if (fireHeld) {
    playAnimation("Backstep");
    return;
  }
  const moving = Math.abs(joyX) + Math.abs(joyY) > 0.17;
  if (!moving) {
    playAnimation("Idle");
  } else if (joyY < -0.25) {
    playAnimation("Backstep");
  } else {
    playAnimation("Walk");
  }
}

function onAnimationFinished(event) {
  if (actions.Jump && event.action === actions.Jump && jumping) {
    jumping = false;
    playerRoot.position.y = 0;
    playAnimation("Landing", true);
  } else if (actions.Landing && event.action === actions.Landing) {
    updateLocomotion();
  } else if (actions.Prone && event.action === actions.Prone && prone) {
    event.action.paused = true;
  } else if (actions.Death && event.action === actions.Death) {
    dead = true;
  }
}

function loadSoldier() {
  const loader = new GLTFLoader();
  loader.load("soldier.glb", (gltf) => {
    soldier = gltf.scene;
    soldier.name = "Rigged_Soldier";
    playerRoot.add(soldier);
    gltfAnimations = gltf.animations;
    mixer = new THREE.AnimationMixer(soldier);
    mixer.addEventListener("finished", onAnimationFinished);

    const names = ["Idle", "Walk", "Backstep", "Jump", "Landing", "Prone", "Death"];
    for (const name of names) {
      const clip = findClip(name);
      if (clip) actions[name] = mixer.clipAction(clip);
    }

    const rightHand = soldier.getObjectByName("mixamorig:RightHand");
    if (rightHand) createWeapon(rightHand);
    const leftArm = soldier.getObjectByName("mixamorig:LeftArm");
    const leftForeArm = soldier.getObjectByName("mixamorig:LeftForeArm");
    const leftHand = soldier.getObjectByName("mixamorig:LeftHand");
    if (leftArm && leftForeArm && leftHand) leftArmChain = [leftForeArm, leftArm, leftHand];

    const loaded = Object.keys(actions).length;
    if (loaded !== names.length) console.warn(`Loaded ${loaded}/${names.length} animations`);
    gameReady = true;
    gameStarted = true;
    document.body.classList.remove("prestart");
    loading.classList.add("hidden");
    setCameraMode(firstPerson);
    playAnimation("Idle");
  }, undefined, (error) => {
    console.error("Soldier GLB load failed", error);
    loading.textContent = "Karakter yuklenemedi. APK varliklarini kontrol edin.";
  });
}

function loadWeaponModels() {
  const loader = new GLTFLoader();
  for (const [index, path] of ["ar70_pbr.glb", "akm.glb"].entries()) {
    loader.load(path, (gltf) => {
      weaponModels[index] = gltf.scene;
      const hand = soldier?.getObjectByName("mixamorig:RightHand");
      if (hand && index === activeWeapon) createWeapon(hand);
      updateWeaponButton();
    }, undefined, (error) => {
      console.error(`Weapon model failed to load: ${path}`, error);
    });
  }
}

function createTracer(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95 }),
  );
  scene.add(line);
  effects.push({ object: line, life: 0.075 });
}

function createImpact(position) {
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 7, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb451, transparent: true }),
  );
  spark.position.copy(position);
  scene.add(spark);
  effects.push({ object: spark, life: 0.22 });
}

function playShotSound() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(115, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(42, audioContext.currentTime + 0.09);
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.11);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (error) {
    console.warn("Shot audio unavailable", error);
  }
}

function shoot() {
  if (!gameReady || dead || reloadTimer > 0 || ammo <= 0 || shotTimer > 0) return;
  shotTimer = aiming ? 0.21 : 0.27;
  ammo--;
  recoil = 1;
  flashTimer = 0.065;
  playShotSound();

  camera.updateMatrixWorld();
  raycaster.setFromCamera(centerScreen, camera);
  const intersections = raycaster.intersectObjects(shotObjects, false);
  const hit = intersections[0];
  const start = new THREE.Vector3();
  if (firstPerson && cameraWeaponMuzzle) {
    cameraWeaponMuzzle.getWorldPosition(start);
  } else if (riflePivot?.userData.muzzle) {
    riflePivot.userData.muzzle.getWorldPosition(start);
  } else {
    camera.getWorldPosition(start);
  }
  if (hit) {
    traceEnd.copy(hit.point);
    createTracer(start, traceEnd);
    if (targetMeshes.includes(hit.object)) {
      targetHits++;
      targetFlash = 0.16;
      if (targetHits >= 3) {
        score++;
        targetHits = 0;
        targetMaterial.color.setHex(0x5d805a);
        window.setTimeout(() => targetMaterial?.color.setHex(0xa44636), 900);
      }
    } else {
      createImpact(hit.point);
    }
  } else {
    traceEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 35);
    createTracer(start, traceEnd);
  }
  if (ammo === 0) startReload();
}

function startReload() {
  if (ammo > 0 || reloadTimer > 0 || dead) return;
  reloadTimer = RELOAD_SECONDS;
}

function beginJump() {
  if (!gameReady || jumping || prone || dead) return;
  jumping = true;
  jumpVelocity = 4.2;
  playAnimation("Jump", true);
}

function toggleProne() {
  if (dead || jumping) return;
  prone = !prone;
  document.querySelector("#prone").classList.toggle("active", prone);
  if (prone) playAnimation("Prone", true);
  else {
    if (actions.Prone) actions.Prone.stop();
    updateLocomotion();
  }
}

function updateCamera(dt) {
  if (firstPerson) {
    camera.position.set(
      playerPosition.x,
      playerPosition.y + (prone ? 0.95 : jumping ? 1.52 : 1.58),
      playerPosition.z,
    );
    cameraAimDirection.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).normalize();
    cameraLookTarget.copy(camera.position).addScaledVector(cameraAimDirection, 12);
    camera.lookAt(cameraLookTarget);
    camera.fov = aiming ? 48 : 68;
    camera.updateProjectionMatrix();
    return;
  }

  const distance = aiming ? 3.1 : 4.4;
  const height = prone ? 0.75 : 1.6;
  forward.set(Math.sin(yaw), 0, Math.cos(yaw));
  cameraFocus.copy(playerPosition);
  cameraFocus.y += prone ? 0.75 : 1.35;
  cameraAimDirection.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).normalize();
  cameraDestination.copy(cameraFocus).addScaledVector(cameraAimDirection, -distance);
  cameraDestination.y += height;
  camera.position.lerp(cameraDestination, 1 - Math.exp(-dt * 8));
  cameraLookTarget.copy(cameraFocus).addScaledVector(cameraAimDirection, 12);
  camera.lookAt(cameraLookTarget);
  const targetFov = aiming ? 46 : 68;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
  camera.updateProjectionMatrix();
}

function solveLeftHandIK() {
  if (!leftArmChain || !riflePivot?.userData.grip) return;
  const [foreArm, upperArm, hand] = leftArmChain;
  riflePivot.userData.grip.getWorldPosition(ikTarget);
  const moving = Math.abs(joyX) + Math.abs(joyY) > 0.15;
  const blend = aiming || fireHeld ? 0.8 : moving ? 0.38 : 0.62;

  for (let iteration = 0; iteration < 3; iteration++) {
    for (const link of [foreArm, upperArm]) {
      playerRoot.updateMatrixWorld(true);
      link.getWorldPosition(ikOrigin);
      hand.getWorldPosition(ikEffector);
      ikCurrent.subVectors(ikEffector, ikOrigin);
      ikDesired.subVectors(ikTarget, ikOrigin);
      if (ikCurrent.lengthSq() < 1e-8 || ikDesired.lengthSq() < 1e-8) continue;
      ikDelta.setFromUnitVectors(ikCurrent.normalize(), ikDesired.normalize());
      link.getWorldQuaternion(ikWorld);
      ikWorld.premultiply(ikDelta);
      link.parent.getWorldQuaternion(ikParentWorld);
      ikLocal.copy(ikParentWorld.invert()).multiply(ikWorld);
      link.quaternion.slerp(ikLocal, blend);
    }
  }
}

function collides(x, z) {
  return blockers.some((item) =>
    Math.abs(x - item.x) < item.width && Math.abs(z - item.z) < item.depth);
}

function update(dt) {
  if (!gameStarted) {
    if (mixer) mixer.update(dt);
    updateCamera(dt);
    return;
  }

  shotTimer = Math.max(0, shotTimer - dt);
  recoil = Math.max(0, recoil - dt * 5);
  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      reloadTimer = 0;
      ammo = 30;
    }
  }
  if (targetFlash > 0) {
    targetFlash = Math.max(0, targetFlash - dt);
    targetMaterial.emissive.setHex(0x55391c);
  } else if (targetMaterial) {
    targetMaterial.emissive.setHex(0x000000);
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.life -= dt;
    if (effect.object.material?.opacity !== undefined)
      effect.object.material.opacity = Math.max(0, effect.life / 0.22);
    if (effect.life <= 0) {
      scene.remove(effect.object);
      effect.object.geometry?.dispose();
      effect.object.material?.dispose();
      effects.splice(i, 1);
    }
  }

  if (muzzleFlash) muzzleFlash.visible = flashTimer > 0;
  if (muzzleLight) muzzleLight.intensity = flashTimer > 0 ? 2.2 : 0;
  if (cameraMuzzleFlash) cameraMuzzleFlash.visible = firstPerson && flashTimer > 0;
  if (cameraMuzzleLight) cameraMuzzleLight.intensity = firstPerson && flashTimer > 0 ? 1.8 : 0;
  flashTimer = Math.max(0, flashTimer - dt);
  if (riflePivot) {
    const reloadPhase = reloadTimer > 0
      ? Math.sin(((RELOAD_SECONDS - reloadTimer) / RELOAD_SECONDS) * Math.PI)
      : 0;
    riflePivot.position.z = 0.04 - recoil * 0.055;
    riflePivot.position.y = -0.035 - reloadPhase * 0.11;
    riflePivot.rotation.x = reloadPhase * 0.26;
  }
  if (cameraWeaponPivot) {
    const reloadPhase = reloadTimer > 0
      ? Math.sin(((RELOAD_SECONDS - reloadTimer) / RELOAD_SECONDS) * Math.PI)
      : 0;
    cameraWeaponPivot.position.z = -0.62 + recoil * 0.075;
    cameraWeaponPivot.position.y = -0.31 - reloadPhase * 0.1;
    cameraWeaponPivot.rotation.x = reloadPhase * 0.18;
  }

  if (!dead && !jumping && (Math.abs(joyX) + Math.abs(joyY) > 0.1)) {
    const speed = prone ? 0.8 : aiming ? 1.8 : 3.0;
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const moveX = (right.x * joyX + forward.x * joyY) * speed * dt;
    const moveZ = (right.z * joyX + forward.z * joyY) * speed * dt;
    if (!collides(playerPosition.x + moveX, playerPosition.z)) playerPosition.x += moveX;
    if (!collides(playerPosition.x, playerPosition.z + moveZ)) playerPosition.z += moveZ;
    playerRoot.rotation.y = yaw;
    updateLocomotion();
  } else if (!jumping) {
    updateLocomotion();
  }

  if (jumping) {
    playerPosition.y += jumpVelocity * dt;
    jumpVelocity -= 10.5 * dt;
    if (playerPosition.y < 0) {
      playerPosition.y = 0;
      jumping = false;
      playAnimation("Landing", true);
    }
  }
  if (!dead) playerRoot.rotation.y = yaw;
  if (mixer) mixer.update(dt);
  if (!firstPerson) solveLeftHandIK();
  updateCamera(dt);
  if (fireHeld) shoot();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
}
window.addEventListener("resize", resize);

function bindButton(id, down, up = null) {
  const button = document.querySelector(`#${id}`);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.setPointerCapture(event.pointerId);
    button.classList.add("active");
    if (gameStarted) down();
  });
  const release = (event) => {
    event.preventDefault();
    button.classList.remove("active");
    if (up) up();
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    if (up) up();
  });
}

bindButton("fire", () => { fireHeld = true; shoot(); }, () => { fireHeld = false; });
bindButton("aim", () => { aiming = true; }, () => { aiming = false; });
bindButton("jump", beginJump);
bindButton("prone", toggleProne);
bindButton("weapon", () => {
  activeWeapon = (activeWeapon + 1) % 2;
  const hand = soldier?.getObjectByName("mixamorig:RightHand");
  if (hand) createWeapon(hand);
  updateWeaponButton();
});
bindButton("camera-first", () => setCameraMode(true));
bindButton("camera-third", () => setCameraMode(false));

function updateWeaponButton() {
  document.querySelector("#weapon").setAttribute(
    "aria-label", `Silah değiştir: ${activeWeapon === 0 ? "AR-70" : "AKM"}`);
}

const stick = document.querySelector("#stick");
const knob = document.querySelector("#stick-knob");
function setJoystick(event) {
  const rect = stick.getBoundingClientRect();
  const radius = rect.width * 0.38;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const magnitude = Math.hypot(dx, dy);
  const scale = magnitude > radius ? radius / magnitude : 1;
  joyX = (dx * scale) / radius;
  joyY = -(dy * scale) / radius;
  knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  updateLocomotion();
}
stick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  setJoystick(event);
});
stick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointer) setJoystick(event);
});
function releaseJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joyX = joyY = 0;
  knob.style.transform = "translate(0, 0)";
  updateLocomotion();
}
stick.addEventListener("pointerup", releaseJoystick);
stick.addEventListener("pointercancel", releaseJoystick);

const lookPad = document.querySelector("#look-pad");
lookPad.addEventListener("pointerdown", (event) => {
  if (event.clientX < window.innerWidth * 0.38) return;
  lookPointer = event.pointerId;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  lookPad.setPointerCapture(event.pointerId);
});
lookPad.addEventListener("pointermove", (event) => {
  if (event.pointerId !== lookPointer) return;
  yaw += (event.clientX - lastLookX) * 0.006;
  pitch = Math.max(-0.45, Math.min(0.65, pitch - (event.clientY - lastLookY) * 0.005));
  lastLookX = event.clientX;
  lastLookY = event.clientY;
});
function releaseLook(event) {
  if (event.pointerId === lookPointer) lookPointer = null;
}
lookPad.addEventListener("pointerup", releaseLook);
lookPad.addEventListener("pointercancel", releaseLook);

window.addEventListener("keydown", (event) => {
  if (!gameStarted) return;
  if (event.code === "KeyW") joyY = 1;
  if (event.code === "KeyS") joyY = -1;
  if (event.code === "KeyA") joyX = -1;
  if (event.code === "KeyD") joyX = 1;
  if (event.code === "Space") beginJump();
  updateLocomotion();
});
window.addEventListener("keyup", (event) => {
  if (!gameStarted) return;
  if (event.code === "KeyW" || event.code === "KeyS") joyY = 0;
  if (event.code === "KeyA" || event.code === "KeyD") joyX = 0;
  updateLocomotion();
});

buildTrainingMap();
updateCamera(1);
loadWeaponModels();
loadSoldier();
animate();
