import { HUMAN_EYE_HEIGHT_UNITS } from "../config/scale";

// Rapier-backed collision for the first-person player. A kinematic capsule is
// swept against fixed cuboid colliders by Rapier's KinematicCharacterController
// — this replaced the hand-rolled downward-ray edge-blocking + AABB props, which
// couldn't model walls/edges robustly. We own the step timing (called from
// Player.update inside the existing game loop) rather than React's <Physics>, so
// there's no second R3F render-loop participant fighting the EffectComposer.
//
// World units (1 m = 1.6 u). Gravity barely matters since the player is almost
// always grounded on the flat roof; it just settles spawn + the safety floor.
const GRAVITY = 25; // u/s²

class PhysicsWorld {
  constructor() {
    this.ready = false;
    this.RAPIER = null;
    this.world = null;
    this.controller = null;
    this.charBody = null;
    this.charCollider = null;
    this.grounded = false;
    this.velocityY = 0;

    // ~1.8 m human capsule. ColliderDesc.capsule(halfHeight, radius) builds a
    // capsule of total height 2*(halfHeight + radius).
    this.capsuleRadius = 0.6;
    this.capsuleHalfHeight = 0.84;
    // The body translation is the capsule CENTER; the eye sits this far above it
    // so callers keep working with an eye-height position (camera follows it).
    this.eyeOffset =
      HUMAN_EYE_HEIGHT_UNITS - (this.capsuleHalfHeight + this.capsuleRadius);

    // Work queued before the WASM finishes loading (init is async, but the
    // layout/spawn may be applied first).
    this._pendingStatics = [];
    this._statics = new Map();
    this._pendingEye = null;
  }

  async init() {
    const mod = await import("@dimforge/rapier3d-compat");
    const RAPIER = mod.default;
    await RAPIER.init();
    this.RAPIER = RAPIER;

    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });

    // Safety floor at street level so the player never falls forever in layouts
    // without a rooftop platform; the rooftop floor/walls keep them up normally.
    this._createStatic({ id: "__worldFloor", hx: 5000, hy: 1, hz: 5000, x: 0, y: -1, z: 0 });

    const cc = this.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.enableAutostep(0.5, 0.2, true); // step over small lips
    cc.enableSnapToGround(0.5); // stay planted on the flat roof
    cc.setApplyImpulsesToDynamicBodies(false);
    this.controller = cc;

    this.charBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased(),
    );
    this.charCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(this.capsuleHalfHeight, this.capsuleRadius),
      this.charBody,
    );

    this.ready = true;

    for (const s of this._pendingStatics) this._createStatic(s);
    this._pendingStatics = [];
    if (this._pendingEye) {
      this.setEye(this._pendingEye);
      this._pendingEye = null;
    }
    this.world.step(); // warm the broad phase before the first query
  }

  // Register a static box collider. (x,y,z) is the box CENTER; hx/hy/hz are
  // half-extents. `id` lets the caller remove it later.
  addStaticBox(id, hx, hy, hz, x, y, z) {
    const spec = { id, hx, hy, hz, x, y, z };
    if (!this.ready) {
      this._pendingStatics.push(spec);
      return;
    }
    this._createStatic(spec);
    this.world.step();
  }

  // Register a static triangle-mesh collider from raw geometry (e.g. a GLB).
  // `vertices` is a flat Float32Array (x,y,z…) in the mesh's local space;
  // `indices` a Uint32Array. (x,y,z) places the mesh origin in the world.
  addStaticTrimesh(id, vertices, indices, x, y, z) {
    const spec = { id, trimesh: { vertices, indices }, x, y, z };
    if (!this.ready) {
      this._pendingStatics.push(spec);
      return;
    }
    this._createStatic(spec);
    this.world.step();
  }

  removeStatic(id) {
    if (!this.ready) {
      this._pendingStatics = this._pendingStatics.filter((s) => s.id !== id);
      return;
    }
    const e = this._statics.get(id);
    if (e) {
      this.world.removeRigidBody(e.body); // removes its collider too
      this._statics.delete(id);
    }
  }

  _createStatic(spec) {
    const RAPIER = this.RAPIER;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x, spec.y, spec.z),
    );
    const colDesc = spec.trimesh
      ? RAPIER.ColliderDesc.trimesh(spec.trimesh.vertices, spec.trimesh.indices)
      : RAPIER.ColliderDesc.cuboid(spec.hx, spec.hy, spec.hz);
    this.world.createCollider(colDesc, body);
    this._statics.set(spec.id, { body });
  }

  // Teleport so the character's EYE is at the given world position.
  setEye(eye) {
    if (!this.ready) {
      this._pendingEye = { x: eye.x, y: eye.y, z: eye.z };
      return;
    }
    const t = { x: eye.x, y: eye.y - this.eyeOffset, z: eye.z };
    this.charBody.setTranslation(t, true);
    this.charBody.setNextKinematicTranslation(t);
    this.velocityY = 0;
  }

  // Advance one frame. (dx, dz) is the desired horizontal displacement this
  // frame (already frame-rate scaled by the caller); dt is seconds. Returns the
  // resolved EYE position, or null if physics isn't ready yet.
  move(dx, dz, dt) {
    if (!this.ready) return null;
    this.velocityY -= GRAVITY * dt;
    const desired = { x: dx, y: this.velocityY * dt, z: dz };
    this.controller.computeColliderMovement(this.charCollider, desired);
    const mv = this.controller.computedMovement();
    const t = this.charBody.translation();
    this.charBody.setNextKinematicTranslation({
      x: t.x + mv.x,
      y: t.y + mv.y,
      z: t.z + mv.z,
    });
    this.world.step();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocityY < 0) this.velocityY = 0;
    const r = this.charBody.translation();
    return { x: r.x, y: r.y + this.eyeOffset, z: r.z };
  }
}

export { PhysicsWorld };
