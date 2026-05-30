import { useEffect, useMemo } from 'react';

export type PlayerController = {
  enabled: boolean;
  mouse_move_x: number;
  mouse_move_y: number;
  mouse_scroll: number;
  key_right: boolean;
  key_down: boolean;
  key_left: boolean;
  key_up: boolean;
  key_shift: boolean;
  key_plus: boolean;
  key_minus: boolean;
  key_f: boolean;
  key_r: boolean;
  key_pressed_f: boolean;
  key_pressed_r: boolean;
  key_pressed_right_bracket: boolean;
  key_pressed_left_bracket: boolean;
  key_pressed_p: boolean;
  key_pressed_space: boolean;
  key_pressed_1: boolean;
  key_pressed_2: boolean;
  key_pressed_3: boolean;
  mb_right: boolean;
  mb_middle: boolean;
  mb_left: boolean;
  mb_left_released: boolean;
  update: () => void;
  on_mouse_wheel: (event: WheelEvent) => void;
  get_mouse_wheel: () => number;
  on_mouse_move: (event: MouseEvent) => void;
  on_key_down: (event: KeyboardEvent) => void;
  on_key_up: (event: KeyboardEvent) => void;
  on_mouse_down: (event: MouseEvent) => void;
  on_mouse_up: (event: MouseEvent) => void;
};

export function usePlayerController(): PlayerController {
  const controller = useMemo<PlayerController>(
    () => ({
      enabled: false,
      mouse_move_x: 0,
      mouse_move_y: 0,
      mouse_scroll: 0,
      key_right: false,
      key_down: false,
      key_left: false,
      key_up: false,
      key_shift: false,
      key_plus: false,
      key_minus: false,
      key_f: false,
      key_r: false,
      key_pressed_f: false,
      key_pressed_r: false,
      key_pressed_right_bracket: false,
      key_pressed_left_bracket: false,
      key_pressed_p: false,
      key_pressed_space: false,
      key_pressed_1: false,
      key_pressed_2: false,
      key_pressed_3: false,
      mb_right: false,
      mb_middle: false,
      mb_left: false,
      mb_left_released: false,
      update() {
        this.mouse_move_x = 0;
        this.mouse_move_y = 0;
        this.key_pressed_f = false;
        this.key_pressed_r = false;
        this.key_pressed_right_bracket = false;
        this.key_pressed_left_bracket = false;
        this.key_pressed_p = false;
        this.key_pressed_space = false;
        this.key_pressed_1 = false;
        this.key_pressed_2 = false;
        this.key_pressed_3 = false;
        this.mb_left_released = false;
      },
      on_mouse_wheel(event: WheelEvent) {
        this.mouse_scroll = event.deltaY;
      },
      get_mouse_wheel() {
        const v = this.mouse_scroll;
        this.mouse_scroll = 0;
        return v;
      },
      on_mouse_move(event: MouseEvent) {
        if (this.enabled) {
          const eventAny = event as MouseEvent & {
            mozMovementX?: number;
            mozMovementY?: number;
            webkitMovementX?: number;
            webkitMovementY?: number;
          };
          this.mouse_move_x =
            event.movementX ||
            eventAny.mozMovementX ||
            eventAny.webkitMovementX ||
            0;
          this.mouse_move_y =
            event.movementY ||
            eventAny.mozMovementY ||
            eventAny.webkitMovementY ||
            0;
        }
      },
      on_key_down(event: KeyboardEvent) {
        if (this.enabled) {
          switch (event.code) {
            case 'Digit1':
              this.key_pressed_1 = true;
              break;
            case 'Digit2':
              this.key_pressed_2 = true;
              break;
            case 'Digit3':
              this.key_pressed_3 = true;
              break;
            case 'KeyD':
              this.key_right = true;
              break;
            case 'KeyS':
              this.key_down = true;
              break;
            case 'KeyA':
              this.key_left = true;
              break;
            case 'KeyW':
              this.key_up = true;
              break;
            case 'ShiftLeft':
              this.key_shift = true;
              break;
            case 'Equal':
              this.key_plus = true;
              break;
            case 'Minus':
              this.key_minus = true;
              break;
            case 'BracketLeft':
              this.key_pressed_left_bracket = true;
              break;
            case 'BracketRight':
              this.key_pressed_right_bracket = true;
              break;
            case 'KeyP':
              this.key_pressed_p = true;
              break;
            case 'Space':
              this.key_pressed_space = true;
              break;
            case 'KeyF':
              this.key_f = true;
              this.key_pressed_f = true;
              break;
            case 'KeyR':
              this.key_r = true;
              this.key_pressed_r = true;
              break;
            default:
              break;
          }
        }
      },
      on_key_up(event: KeyboardEvent) {
        if (this.enabled) {
          switch (event.code) {
            case 'KeyD':
              this.key_right = false;
              break;
            case 'KeyS':
              this.key_down = false;
              break;
            case 'KeyA':
              this.key_left = false;
              break;
            case 'KeyW':
              this.key_up = false;
              break;
            case 'ShiftLeft':
              this.key_shift = false;
              break;
            case 'Equal':
              this.key_plus = false;
              break;
            case 'Minus':
              this.key_minus = false;
              break;
            case 'KeyF':
              this.key_f = false;
              break;
            case 'KeyR':
              this.key_r = false;
              break;
            default:
              break;
          }
        }
      },
      on_mouse_down(event: MouseEvent) {
        if (this.enabled) {
          // event.button: 0 = left, 1 = middle, 2 = right (event.which is deprecated)
          switch (event.button) {
            case 0:
              this.mb_left = true;
              break;
            case 1:
              this.mb_middle = true;
              break;
            case 2:
              this.mb_right = true;
              break;
            default:
              break;
          }
        }
      },
      on_mouse_up(event: MouseEvent) {
        if (this.enabled) {
          switch (event.button) {
            case 0:
              this.mb_left = false;
              this.mb_left_released = true;
              break;
            case 1:
              this.mb_middle = false;
              break;
            case 2:
              this.mb_right = false;
              break;
            default:
              break;
          }
        }
      }
    }),
    []
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => controller.on_mouse_move(event);
    const onMouseDown = (event: MouseEvent) => controller.on_mouse_down(event);
    const onMouseUp = (event: MouseEvent) => controller.on_mouse_up(event);
    const onKeyDown = (event: KeyboardEvent) => controller.on_key_down(event);
    const onKeyUp = (event: KeyboardEvent) => controller.on_key_up(event);
    const onMouseWheel = (event: WheelEvent) => controller.on_mouse_wheel(event);

    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('mousedown', onMouseDown, false);
    document.addEventListener('mouseup', onMouseUp, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    // Standard 'wheel' event ('mousewheel' is legacy/non-standard and never
    // fired in Firefox). on_mouse_wheel reads event.deltaY, which 'wheel' provides.
    document.addEventListener('wheel', onMouseWheel, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMouseMove, false);
      document.removeEventListener('mousedown', onMouseDown, false);
      document.removeEventListener('mouseup', onMouseUp, false);
      document.removeEventListener('keydown', onKeyDown, false);
      document.removeEventListener('keyup', onKeyUp, false);
      document.removeEventListener('wheel', onMouseWheel);
    };
  }, [controller]);

  return controller;
}
