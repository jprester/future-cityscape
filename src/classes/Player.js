import { PerspectiveCamera, Object3D, Vector3 } from "three";
import { frameFactor, smoothingFactor } from "../utils";
import { HUMAN_EYE_HEIGHT_UNITS } from "../config/scale";

class Player {
  constructor(params) {
    // params

    this.controller = params.controller;
    // Game reference — used to query the collider for the surface underfoot.
    this.game = params.game;

    // settings

    // Real-scale eye height: ~1.70 m above the ground for a ~180 cm human
    // (see config/scale.ts — 1 m = 1.6 world units, anchored to the block size).
    this.player_height = HUMAN_EYE_HEIGHT_UNITS;
    this.mouse_sensitivity = 0.00125; //0.002;
    this.look_smooth = 0.15; //0.075;
    this.look_roll_factor = 0.1;
    this.max_look_speed = 200;

    this.move_accel = 0.25; //0.01;

    this.walk_speed = 0.65; //0.1;
    this.run_speed = 4; //0.2;

    // audio

    this.soundWind = null;
    this.soundCityAmbient = null;

    // init

    // Vertical FOV. ~58° reads as a natural human perspective (80° was
    // ~112° horizontal — fisheye-wide, which shrank the buildings/windows).
    this.camera_fov = 58;
    this.camera_fov_to = this.camera_fov;

    this.camera =
      params.camera ||
      new PerspectiveCamera(
        this.camera_fov,
        window.innerWidth / window.innerHeight,
        1,
        2800,
      );
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = Math.PI;
    this.camera.position.y = this.player_height;
    this.camera.fov = this.camera_fov;
    this.camera.near = 1;
    this.camera.far = 2800;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.camera_target = new Object3D(); // used to get camera rotation set by PointerLockControls
    this.camera_target.rotation.order = "YXZ";
    this.camera_target.rotation.y = Math.PI;

    this.body = new Object3D();
    this.body.position.x = params.x;
    this.body.position.z = params.z;
    this.body.position.y = this.player_height;

    this.noise_shake = new Perlin();
    this.noise_shake.noiseDetail(8, 0.5);

    this.velocity = new Vector3();
    this.move_max_speed = 0;
    this.move_max_speed_current = 0;

    // gravity — the player is a grounded human, not a free-flying camera.
    // `gravity` is a per-frame (60fps) downward acceleration; `velocity_y` is
    // the resulting vertical speed. Reused scratch vectors keep the per-frame
    // ground raycast allocation-free.
    this.gravity = 0.3;
    this.velocity_y = 0;
    this._groundOrigin = new Vector3();
    this._groundDir = new Vector3(0, -1, 0);
  }

  update(delta = 1 / 60) {
    // Normalized frame factor: 1.0 at 60fps. Linear per-frame increments are
    // multiplied by `f`; exponential smoothing uses smoothingFactor(rate, f).
    // Mouse-look is driven by physical mouse deltas, so it stays unscaled.
    const f = frameFactor(delta);

    /*--- UPDATE CAMERA ---*/

    var movementX = this.controller.mouse_move_x;
    var movementY = this.controller.mouse_move_y;
    // limit movement
    if (movementX > this.max_look_speed) movementX = this.max_look_speed;
    if (movementX < -this.max_look_speed) movementX = -this.max_look_speed;
    if (movementY > this.max_look_speed) movementY = this.max_look_speed;
    if (movementY < -this.max_look_speed) movementY = -this.max_look_speed;
    // pitch
    this.camera_target.rotation.x -= movementY * this.mouse_sensitivity;
    if (this.camera_target.rotation.x < -Math.PI / 2 + 0.01)
      this.camera_target.rotation.x = -Math.PI / 2 + 0.01;
    if (this.camera_target.rotation.x > Math.PI / 2 - 0.01)
      this.camera_target.rotation.x = Math.PI / 2 - 0.01;
    // yaw
    this.camera_target.rotation.y -= movementX * this.mouse_sensitivity;

    // zoom
    let mouse_wheel_delta = this.controller.get_mouse_wheel();
    if (mouse_wheel_delta !== 0) {
      this.camera_fov_to += mouse_wheel_delta * 0.05;
      this.camera_fov_to = Math.max(Math.min(this.camera_fov_to, 90), 30);
    }
    this.camera.fov +=
      (this.camera_fov_to - this.camera.fov) * smoothingFactor(0.1, f);
    this.camera.updateProjectionMatrix();

    // set camera postion to body position
    this.camera.position.z = this.body.position.z;
    this.camera.position.x = this.body.position.x;
    this.camera.position.y = this.body.position.y;

    // roll
    this.camera_target.rotation.z =
      -this.angle_dist(this.camera_target.rotation.y, this.camera.rotation.y) *
      this.look_roll_factor;

    // smooth look
    this.camera.quaternion.slerp(
      this.camera_target.quaternion,
      smoothingFactor(this.look_smooth, f),
    );

    /*--- UPDATE VELOCITY ---*/

    // accelerate
    if (
      this.controller.key_up ||
      this.controller.key_down ||
      this.controller.key_left ||
      this.controller.key_right
    ) {
      if (this.controller.key_up) {
        this.velocity.z -=
          Math.cos(-this.camera.rotation.y) * this.move_accel * f;
        this.velocity.x +=
          Math.sin(-this.camera.rotation.y) * this.move_accel * f;
      }
      if (this.controller.key_down) {
        this.velocity.z -=
          Math.cos(-this.camera.rotation.y + Math.PI) * this.move_accel * f;
        this.velocity.x +=
          Math.sin(-this.camera.rotation.y + Math.PI) * this.move_accel * f;
      }
      if (this.controller.key_left) {
        this.velocity.z -=
          Math.cos(-this.camera.rotation.y - Math.PI / 2) * this.move_accel * f;
        this.velocity.x +=
          Math.sin(-this.camera.rotation.y - Math.PI / 2) * this.move_accel * f;
      }
      if (this.controller.key_right) {
        this.velocity.z -=
          Math.cos(-this.camera.rotation.y + Math.PI / 2) * this.move_accel * f;
        this.velocity.x +=
          Math.sin(-this.camera.rotation.y + Math.PI / 2) * this.move_accel * f;
      }
    }
    // decelerate
    else {
      this.velocity.clampLength(
        0,
        this.velocity.length() - this.move_accel * f,
      );
    }

    // max speed
    this.move_max_speed = this.controller.key_shift
      ? this.run_speed
      : this.walk_speed;
    if (this.move_max_speed_current < this.move_max_speed)
      this.move_max_speed_current = this.move_max_speed;
    if (this.move_max_speed_current > this.move_max_speed)
      this.move_max_speed_current -= this.move_accel * f;
    this.velocity.clampLength(0, this.move_max_speed_current);

    /*--- UPDATE POSITION (HORIZONTAL) with EDGE BLOCKING ---*/

    // Realistic human: a constant ground-level walking/running pace (the old
    // altitude-based speed scaling went with flight, which is now gone).
    //
    // Edge blocking ("rooftop parapet"): while the player is standing on a
    // surface, a step is only taken if the ground at the destination isn't far
    // below the current surface — so they stop at the real edge of the roof and
    // can't walk off into thin air. This follows the actual roof shape (a box
    // clamp from the model's bounding box failed: the tower tapers, so its bbox
    // footprint is wider than the walkable roof). Tested per-axis so the player
    // slides along an edge rather than sticking. While airborne, movement is
    // free (air control + the spawn settling onto the roof).
    const collider = this.game && this.game.collider;
    const colliderReady =
      collider && collider.enabled && collider.meshes.length > 0;

    const probeY = this.body.position.y + 2;
    const curSurfaceY = colliderReady
      ? this.sampleGroundHeight(
          this.body.position.x,
          this.body.position.z,
          probeY,
        )
      : 0;
    const grounded =
      colliderReady &&
      this.body.position.y <= curSurfaceY + this.player_height + 0.5;

    const newX = this.body.position.x + this.velocity.x * f;
    const newZ = this.body.position.z + this.velocity.z * f;

    if (!grounded) {
      this.body.position.x = newX;
      this.body.position.z = newZ;
    } else {
      // Allow small step-downs (curbs, rooftop details); block big drops (edges).
      const MAX_STEP_DOWN = 8;
      if (
        this.sampleGroundHeight(newX, this.body.position.z, probeY) >=
        curSurfaceY - MAX_STEP_DOWN
      ) {
        this.body.position.x = newX;
      }
      if (
        this.sampleGroundHeight(this.body.position.x, newZ, probeY) >=
        curSurfaceY - MAX_STEP_DOWN
      ) {
        this.body.position.z = newZ;
      }
    }

    /*--- GRAVITY + STAND ON SURFACE ---*/

    // The player rests on whatever surface is directly below — a building roof,
    // or the street (y = 0) as the world floor — and falls under gravity if
    // somehow off a surface. Flight (R/F altitude) has been removed entirely.
    if (colliderReady) {
      const surfaceY = this.sampleGroundHeight(
        this.body.position.x,
        this.body.position.z,
        this.body.position.y + 2,
      );
      const targetEyeY = surfaceY + this.player_height;

      if (this.body.position.y > targetEyeY + 0.01) {
        // Airborne — accelerate downward, then land on the surface.
        this.velocity_y -= this.gravity * f;
        this.body.position.y += this.velocity_y * f;
        if (this.body.position.y <= targetEyeY) {
          this.body.position.y = targetEyeY;
          this.velocity_y = 0;
        }
      } else {
        // Grounded — stick to the surface (also steps up small rises).
        this.body.position.y = targetEyeY;
        this.velocity_y = 0;
      }
    }

    /*--- UPDATE AUDIO ---*/

    if (this.soundWind)
      this.soundWind.setVolume(
        Math.min(Math.max(this.velocity.length() - this.walk_speed, 0), 1) *
          0.1,
      );
    if (this.soundCityAmbient)
      this.soundCityAmbient.setVolume(1 - this.body.position.y / 800);
  }

  // Height of the nearest collision surface directly below (x, z), looking down
  // from `fromY`. Buildings (incl. the rooftop the player stands on) are
  // registered with the collider; the street is not, so we fall back to y = 0
  // as the world floor when the downward ray hits nothing.
  sampleGroundHeight(x, z, fromY) {
    const collider = this.game && this.game.collider;
    if (!collider) return 0;
    this._groundOrigin.set(x, fromY, z);
    const hits = collider.raycast(this._groundOrigin, this._groundDir);
    if (hits && hits.length > 0) {
      return Math.max(hits[0].point.y, 0);
    }
    return 0;
  }

  // window resize callback
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /*----- UTILS -----*/

  // shortest signed distance between two angles (radians)
  angle_dist(a, b) {
    var posDist, negDist;
    a = this.fix_angle(a);
    b = this.fix_angle(b);
    if (b > a) {
      posDist = b - a;
      negDist = a + (Math.PI * 2 - b);
    } else {
      posDist = b + (Math.PI * 2 - a);
      negDist = a - b;
    }
    if (posDist < negDist) {
      return posDist;
    } else {
      return -negDist;
    }
  }

  // ensures angle is between 0 and 360 (radians)
  fix_angle(a) {
    return a - Math.PI * 2 * Math.floor(a / (Math.PI * 2));
  }
}

export { Player };
