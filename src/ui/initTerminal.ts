const version = '1.0.6';
const threeVersion = '0.159.0';

export type TerminalApi = {
  setColor: (c: string) => void;
  write: (s: string, speed: number, delay: number, callback?: (() => void) | null) => void;
  newLine: () => void;
  updateControls: (arr: string[]) => void;
  writeControls: (s: string, callback?: (() => void) | null) => void;
  writeAsset: (url: string, itemsLoaded: number, itemsTotal: number) => void;
  strToBin: (str: string) => string;
  showCredits: () => void;
};

type InitTerminalOptions = {
  terminalEl: HTMLElement | null;
  resourcesEl: HTMLElement | null;
  controlsEl: HTMLElement | null;
  cursorEl: HTMLElement | null;
  onShowSettings?: () => void;
  onStartLoad?: () => void;
};

export function initTerminal({
  terminalEl,
  resourcesEl,
  controlsEl,
  cursorEl,
  onShowSettings,
  onStartLoad
}: InitTerminalOptions): { api: TerminalApi | null; cleanup: () => void } {
  if (!terminalEl || !resourcesEl || !controlsEl || !cursorEl) {
    return { api: null, cleanup: () => {} };
  }

  let colorClass = 'c1';
  let controlsInterval: ReturnType<typeof setInterval> | null = null;
  let cursorVisible = true;

  function setColor(c) {
    colorClass = c;
  }

  function write(s: string, speed: number, delay: number, callback?: (() => void) | null) {
    let i = 0;
    const interval = setInterval(function () {
      const newNode = document.createElement('span');
      newNode.className = colorClass;
      let textNode = null;
      if (s.charAt(i) === ' ') {
        textNode = document.createTextNode('\u00A0');
      } else {
        textNode = document.createTextNode(s.charAt(i));
      }
      newNode.appendChild(textNode);
      terminalEl.insertBefore(newNode, cursorEl);

      i++;
      if (i === s.length) {
        clearInterval(interval);
        if (callback) {
          setTimeout(callback, delay);
        }
      }
    }, speed);
  }

  function newLine() {
    const node = document.createElement('br');
    terminalEl.insertBefore(node, cursorEl);
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }

  function writeControls(s: string, callback?: (() => void) | null) {
    let i = 0;
    const linebreak = document.createElement('br');
    controlsEl.insertBefore(linebreak, controlsEl.lastChild);
    controlsInterval = setInterval(function () {
      const newNode = document.createElement('span');
      newNode.className = 'c1';
      const textNode = document.createTextNode(s.charAt(i));
      newNode.appendChild(textNode);
      controlsEl.insertBefore(newNode, controlsEl.lastChild);
      i++;
      if (i === s.length) {
        clearInterval(controlsInterval);
        if (callback) callback();
      }
    }, 0);
  }

  function updateControls(arr: string[]) {
    controlsEl.innerHTML = '';
    if (controlsInterval) {
      clearInterval(controlsInterval);
    }
    writeControls(arr[0], function () {
      writeControls(arr[1], function () {
        writeControls(arr[2], function () {
          writeControls(arr[3], function () {
            writeControls(arr[4], function () {
              writeControls(arr[5], null);
            });
          });
        });
      });
    });
  }

  function writeAsset(url: string, itemsLoaded: number, itemsTotal: number) {
    const exts = ['.cfg', '.dll', '.bio', '.tek', '.bin', '.syn', '.dna', '.xlc'];
    const coolName = makeId() + exts[Math.floor(Math.random() * exts.length)];
    const percent = ((itemsLoaded / itemsTotal) * 100).toFixed(2);

    const lineBreak = document.createElement('br');
    resourcesEl.insertBefore(lineBreak, resourcesEl.firstChild);

    const newNode = document.createElement('span');
    const textNode = document.createTextNode('>> [' + percent + '%] ' + coolName);
    newNode.appendChild(textNode);
    resourcesEl.insertBefore(newNode, resourcesEl.firstChild);
  }

  function strToBin(str: string) {
    let res = '';
    res = str
      .split('')
      .map((char) => {
        return char.charCodeAt(0).toString(2);
      })
      .join(' ');
    return res.substring(0, 32);
  }

  function showCredits() {
    setTimeout(function () {
      newLine();
      newLine();
      setColor('c1');
      write('synthcity --credits', 80, 800, function () {
        newLine();
        newLine();
        setColor('c4');
        write('<3d graphics library> three.js [threejs.org]', 0, 50, function () {
          newLine();
          write('<bladerunner car> quaz30 [sketchfab.com/quaz30]', 0, 50, function () {
            newLine();
            write('<sound fx> freesound [freesound.org]', 0, 50, function () {
              newLine();
              newLine();
              write('# Music from #Uppbeat (free for Creators!)', 0, 50, function () {
                newLine();
                newLine();
                write('<prigida> [uppbeat.io/browse/artist/prigida]', 0, 50, function () {
                  newLine();
                  write('<pecan-pie> [uppbeat.io/browse/artist/pecan-pie]', 0, 50, function () {
                    newLine();
                    write('<mountaineer> [uppbeat.io/browse/artist/mountaineer]', 0, 50, function () {
                      newLine();
                      write('<d0d> [uppbeat.io/browse/artist/d0d]', 0, 50, function () {
                        newLine();
                        write('<fass> [uppbeat.io/browse/artist/fass]', 0, 50, function () {
                          newLine();
                          write('<tatami> [uppbeat.io/browse/artist/tatami]', 0, 50, function () {
                            newLine();
                            write(
                              '<kaleidoscope> [uppbeat.io/browse/artist/kaleidoscope]',
                              0,
                              50,
                              function () {
                                newLine();
                                write('<noise-cake> [uppbeat.io/browse/artist/noise-cake]', 0, 50, function () {
                                  newLine();
                                  write('<mood-maze> [uppbeat.io/browse/artist/mood-maze]', 0, 50, function () {
                                    newLine();
                                    write('<bosnow> [uppbeat.io/browse/artist/bosnow]', 0, 50, function () {
                                      newLine();
                                      write('<tecnosine> [uppbeat.io/browse/artist/tecnosine]', 0, 50, function () {
                                        newLine();
                                      });
                                    });
                                  });
                                });
                              }
                            );
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    }, 2500);
  }

  const cursorBlinkIntervalId = setInterval(function () {
    if (cursorVisible === true) {
      cursorEl.style.visibility = 'hidden';
      cursorVisible = false;
    } else {
      cursorEl.style.visibility = 'visible';
      cursorVisible = true;
    }
  }, 400);

  const api: TerminalApi = {
    setColor,
    write,
    newLine,
    updateControls,
    writeControls,
    writeAsset,
    strToBin,
    showCredits
  };

  runBootSequence(api, { onShowSettings, onStartLoad });

  const cleanup = () => {
    clearInterval(cursorBlinkIntervalId);
    if (controlsInterval) {
      clearInterval(controlsInterval);
    }
  };

  return { api, cleanup };
}

function runBootSequence(
  api: TerminalApi,
  { onShowSettings, onStartLoad }: { onShowSettings?: () => void; onStartLoad?: () => void },
) {
  setTimeout(function () {
    api.setColor('c1');
    api.write('synthcity --run', 80, 500, function () {
      api.newLine();
      if (isMobile()) {
        api.newLine();
        api.setColor('g1');
        api.write('>> Error: Mobile devices not supported', 0, 0, null);
      } else {
        api.setColor('g1');
        api.write('                      __  .__           .__  __        ', 0, 0, function () {
          api.newLine();
          api.setColor('g1');
          api.write('  _________.__. _____/  |_|  |__   ____ |__|/  |_ ___.__.', 0, 0, function () {
            api.newLine();
            api.setColor('g2');
            api.write(' /  ___<   |  |/    \\   __\\  |  \\_/ ___\\|  \\   __<   |  |', 0, 0, function () {
              api.newLine();
              api.setColor('g3');
              api.write(' \\___ \\ \\___  |   |  \\  | |   Y  \\  \\___|  ||  |  \\___  |', 0, 0, function () {
                api.newLine();
                api.setColor('g4');
                api.write('/____  >/ ____|___|  /__| |___|  /\\___  >__||__|  / ____|', 0, 0, function () {
                  api.newLine();
                  api.setColor('g5');
                  api.write('     \\/ \\/         \\/          \\/     \\/          \\/     ', 0, 0, function () {
                    api.newLine();
                    api.newLine();
                    api.setColor('g1');
                    api.write('   an interactive audiovisual experience by jeff beene', 0, 0, function () {
                      api.newLine();
                      api.newLine();
                      api.write('▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚', 0, 800, function () {
                        api.newLine();
                        api.newLine();
                        api.setColor('c3');
                        api.write('>> initiating boot sequence...', 0, 500, function () {
                          if (onShowSettings) onShowSettings();

                          api.newLine();
                          api.newLine();
                          api.setColor('c4');
                          api.write('build version: ' + version, 0, 50, function () {
                            api.newLine();
                            api.write('system manufacturer: jeff beene [www.jeff-beene.com]', 0, 50, function () {
                              api.newLine();
                              api.write('system boot time: ' + bootDate(), 0, 50, function () {
                                api.newLine();
                                api.write('os name: three.js', 0, 50, function () {
                                  api.newLine();
                                  api.write('os version: ' + threeVersion, 0, 50, function () {
                                    api.newLine();
                                    api.write('audio driver: uppbeat.io', 0, 50, function () {
                                      api.newLine();
                                      api.newLine();
                                      api.setColor('c3');
                                      api.write('>> loading resources...', 0, 50, function () {
                                        if (onStartLoad) onStartLoad();
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      }
    });
  }, 800);
}

function bootDate() {
  let value = new Date().toISOString();
  value = '1982' + value.substring(4, value.length - 4);
  return value;
}

function isMobile() {
  let check = false;
  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
        a
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        a.substr(0, 4)
      )
    ) {
      check = true;
    }
  })(
    navigator.userAgent ||
      navigator.vendor ||
      (window as Window & { opera?: string }).opera,
  );
  return check;
}

function makeId() {
  let length = 16 + Math.random() * 28;
  let result = '';
  const characters = '$%@~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
