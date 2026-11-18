'use strict';

// ════ Codex 7차 모션 띠 재생 ════
// 동작 하나 = 가로 띠 그림 한 장(한 칸 280×255, 발 기준 가로 140·세로 249, 오른쪽 보기).
// data-pose(대기·준비·타격·맞음 같은 '상태')와 정지 그림은 그대로 두고, 그 상태가 시작된 시각과 길이로
// 띠의 몇 번째 칸인지 골라 스프라이트 안 캔버스(canvas.anim)에 그린다. 띠가 없거나 아직 못 읽은 그림은 기존 정지 그림이 보인다.
// 띠 주소는 CSS 변수(--anim-동작, 주인공 장비 마스크는 --animmask-동작)로 받는다. 한 파일 묶음이 CSS 그림을 내장하기 때문.
// 그리기는 화면 주사율(requestAnimationFrame, 보통 초당 60번)로 돈다. 엔진·보상 계산은 건드리지 않는다.

const ANIM_CELL = { w: 280, h: 255 };
const ANIM_CLIPS = ['idle', 'run', 'punch', 'hit', 'down', 'victory', 'kick', 'knee', 'throw', 'hold', 'guard', 'rush', 'counter', 'combo', 'cheer', 'drink', 'step', 'getup', 'attack', 'skill'];
// 타격 칸(0부터). 이 칸이 엔진의 타격 순간(impact)에 보이도록 앞은 준비, 뒤는 마무리로 나눈다
// Codex 9차(work/codex-motion-handoff-9.md)에서 중간 칸이 들어가 발차기·무릎·반격·연타 4번째, 메치기·돌진 5번째, 굳히기 6번째로 밀렸다
const ANIM_IMPACT = { punch: 2, kick: 3, knee: 3, throw: 4, hold: 5, rush: 4, counter: 3, combo: 3, step: 2 };
// 종목 동작(arena data-motion) → 주인공 공격 띠. 태권도(spar)는 보호구 정지 그림을 쓰므로 띠 없음
const HERO_CONTEST_CLIP = { strike: 'punch', kick: 'kick', knee: 'knee', throw: 'throw', hold: 'hold' };
// 매끄러운 띠(주인공부터): 원래 칸 사이마다 SMOOTH_K칸을 광학 흐름으로 끼운 띠(--animsmooth-동작, work/tools/smooth_strip.py).
// 원래 i번째 칸 = 매끄러운 띠의 i*(k+1)번째 칸이라 동작 계획(칸 번호)은 그대로 쓰고 여기서 옮긴다.
// k는 기본 5칸. 원래 칸이 7~8개면 4칸, 9개면 3칸(칸 사이가 이미 좁고, 띠 폭을 36칸 안으로 묶어 장비 색 띠 메모리를 줄임).
// 띠를 다시 만들 때 같은 k를 써야 한다(README 참고).
// 반복 띠(대기·달리기)는 마지막 칸 → 첫 칸 사이도 메웠다. animSmooth[id]를 끄면 원래 띠로 돈다.
const SMOOTH_K = 5;
const SMOOTH_K_CLIP = { combo: 4, counter: 4, kick: 4, knee: 4, hold: 3, rush: 3, throw: 3 };
function smoothK(clip) { return SMOOTH_K_CLIP[clip] ?? SMOOTH_K; }
const SMOOTH_LOOPS = ['idle', 'run'];
const animSmooth = { boy: true };
// 동작이 바뀌는 순간(대기 → 공격, 공격 → 대기, 맞음 → 대기): 앞 동작의 마지막 그림을 잠깐 겹쳐 지워 툭 바뀌지 않게 한다.
// 맞는 순간(→ hit)은 타격감을 위해 바로 바꾼다. 매끄러운 띠를 쓰는 스프라이트만
const ANIM_BLEND_MS = 70;
const ANIM_BLEND_SKIP = ['hit'];
const HERO_SKILL_CLIP = { rush: 'rush', counter: 'counter', combo: 'combo', step: 'step', cheer: 'cheer', drink: 'drink' };

// 동작 계획 = [띠, 첫 칸, 끝 칸(-1 = 마지막), 방식, 초당 칸]
// loop = 반복(대기·달리기). 시계 기준이라 상태가 다시 정해져도 끊기지 않는다
// span = 그 상태가 이어지는 시간에 맞춰 첫 칸 → 끝 칸(공격 준비·타격·마무리, 맞음, 스킬)
// once = 초당 칸 수로 한 번 재생하고 끝 칸에 멈춤(승리, 쓰러짐)
function heroPlan(pose, prev, timed, motion) {
  if (motion === 'spar') return null;
  const contest = HERO_CONTEST_CLIP[motion];
  const skillOf = name => HERO_SKILL_CLIP[/^skill-([a-z]+)/.exec(name || '')?.[1]];
  const skill = skillOf(pose);
  if (skill) {
    const hit = ANIM_IMPACT[skill] ?? 2;
    if (/-(windup|guard)$/.test(pose)) return [skill, 0, hit - 1, 'span'];
    if (/-strike$/.test(pose)) return skill === 'combo' ? [skill, hit, -1, 'span'] : [skill, hit, hit, 'span'];
    if (/-follow$/.test(pose)) return [skill, hit, -1, 'span'];
    return [skill, 0, -1, 'span'];
  }
  const hit = ANIM_IMPACT[contest];
  switch (pose) {
    case 'ready': case 'ready-b': case 'step': return ['idle', 0, -1, 'loop', 7];
    // 공격 준비(windup) 다음의 달리기 = 상대 쪽으로 파고드는 동안 주먹을 당긴다. 그 밖의 달리기(전진·등장)는 달리기 띠
    case 'run': return prev === 'windup' && contest ? [contest, 0, hit - 1, 'span'] : ['run', 0, -1, 'loop', 13];
    case 'windup': return contest ? (timed ? [contest, 0, 0, 'span'] : [contest, hit - 1, hit - 1, 'span']) : null;
    case 'strike': return contest ? [contest, hit, hit, 'span'] : null;
    case 'follow': {
      const clip = skillOf(prev) || contest;
      return clip ? [clip, (ANIM_IMPACT[clip] ?? 2) + 1, -1, 'span'] : null;
    }
    case 'hit': return ['hit', 0, -1, 'span'];
    case 'guard': return ['guard', 0, -1, timed ? 'span' : 'once', 10];
    case 'victory': return ['victory', 0, -1, 'once', 9];
    case 'lose': case 'down': return ['down', 0, -1, 'once', 9];
    // 지고 나서 다시 설 때 한 번(쓰러짐 끝 칸 → 손 짚고 → 무릎 → 대기 첫 자세)
    case 'getup': return ['getup', 0, -1, 'once', 9];
  }
  return null;
}

// 건달 졸개·두목: 대기 4, 공격 4(2번째 칸 타격), 맞음 2, 쓰러짐 4. 방어·빈틈 같은 그 밖의 상태는 정지 그림
function thugPlan(pose) {
  switch (pose) {
    case 'ready': case 'step': case 'victory': return ['idle', 0, -1, 'loop', 6];
    case 'windup': case 'launch': return ['attack', 0, 0, 'span'];
    case 'strike': return ['attack', 1, 2, 'span'];
    case 'follow': return ['attack', 2, -1, 'span'];
    case 'hit': return ['hit', 0, -1, 'span'];
    case 'down': return ['down', 0, -1, 'once', 8];
  }
  return null;
}

// 동료: 대기 4, 달리기 4, 공격 5(3번째 칸 타격), 스킬 6(준비 3칸 = skill-a, 터지는 3칸 = skill-b)
function matePlan(pose) {
  switch (pose) {
    case 'ready': return ['idle', 0, -1, 'loop', 6];
    case 'step': case 'run': return ['run', 0, -1, 'loop', 12];
    case 'windup': return ['attack', 0, 1, 'span'];
    case 'strike': return ['attack', 2, 2, 'span'];
    case 'follow': return ['attack', 3, -1, 'span'];
    case 'skill-a': return ['skill', 0, 2, 'span'];
    case 'skill-b': return ['skill', 3, -1, 'span'];
  }
  return null;
}

function animPlan(id, pose, prev, timed, motion) {
  if (id === 'boy') return heroPlan(pose, prev, timed, motion);
  if (/^thug/.test(id)) return thugPlan(pose);
  if (/^mate\d+$/.test(id)) return matePlan(pose);
  return null;
}

// 띠 보기(테스트 모드)용: 그 띠에서 엔진의 타격 순간에 보이는 칸(없으면 -1)과 게임에서 반복·한 번 재생할 때의 초당 칸 수
function animImpactFrame(id, clip) {
  if (id === 'boy') return ANIM_IMPACT[clip] ?? -1;
  if (/^thug/.test(id)) return clip === 'attack' ? 1 : -1;
  if (/^mate\d+$/.test(id)) return clip === 'attack' ? 2 : clip === 'skill' ? 3 : -1;
  return -1;
}
function animClipFps(id, clip) {
  const pose = { idle: 'ready', run: 'run', victory: 'victory', down: 'down', guard: 'guard' }[clip];
  const plan = pose && (id === 'boy' ? heroPlan(pose, null, false, '') : /^thug/.test(id) ? thugPlan(pose) : /^mate\d+$/.test(id) ? matePlan(pose) : null);
  return plan?.[4] || 10;
}

// ── 띠 주소(CSS 변수)와 그림 읽기 ──
const animUrls = new Map();
function animUrl(sprite, id, clip, mask = false, smooth = false) {
  let urls = animUrls.get(id);
  if (!urls) {
    const css = getComputedStyle(sprite);
    urls = {};
    for (const name of ANIM_CLIPS) {
      urls[name] = urlValue(css.getPropertyValue(`--anim-${name}`));
      urls[`mask:${name}`] = urlValue(css.getPropertyValue(`--animmask-${name}`));
      urls[`smooth:${name}`] = urlValue(css.getPropertyValue(`--animsmooth-${name}`));
      urls[`smooth:mask:${name}`] = urlValue(css.getPropertyValue(`--animsmoothmask-${name}`));
    }
    animUrls.set(id, urls);
  }
  return urls[`${smooth ? 'smooth:' : ''}${mask ? 'mask:' : ''}${clip}`];
}
// 이 스프라이트에 매끄러운 띠를 쓸지(켜져 있고 그림과 마스크가 다 있을 때)
function smoothOn(sprite, id, clip) {
  return Boolean(animSmooth[id] && animUrl(sprite, id, clip, false, true) && (id !== 'boy' || animUrl(sprite, id, clip, true, true)));
}

const animImages = new Map();
function animImage(url) {
  let entry = animImages.get(url);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, failed: false, frames: 0 };
    img.decoding = 'async';
    // decode()는 화면이 가려져 있으면 끝나지 않을 수 있어 load로 준비를 판단하고, decode는 미리 풀어 두는 용도로만 쓴다
    entry.loaded = new Promise(resolve => {
      const done = ok => {
        if (entry.ready || entry.failed) return;
        if (ok && img.naturalWidth) {
          entry.ready = true;
          entry.frames = Math.max(1, Math.round(img.naturalWidth / ANIM_CELL.w));
        } else entry.failed = true;
        resolve();
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
      if (img.complete) done(Boolean(img.naturalWidth));
    });
    img.decode?.().catch(() => {});
    animImages.set(url, entry);
  }
  return entry;
}

function animPixels(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

// 주인공은 입은 장비 색으로 띠 전체를 한 번 칠해 두고(마스크 띠: 빨강 상의·초록 하의·파랑 태그·노랑 신발) 그 띠에서 칸을 꺼낸다
const animTinted = new Map();
function tintedStrip(sprite, id, clip, url, outfit, smooth = false) {
  const key = `${url}|${outfit}`;
  let entry = animTinted.get(key);
  if (entry) return entry;
  const maskUrl = animUrl(sprite, id, clip, true, smooth);
  entry = { ready: false, failed: !maskUrl, canvas: null, frames: 0 };
  animTinted.set(key, entry);
  if (animTinted.size > 24) animTinted.delete(animTinted.keys().next().value);
  if (!maskUrl) return entry;
  const base = animImage(url);
  const mask = animImage(maskUrl);
  Promise.all([base.loaded, mask.loaded]).then(() => {
    if (!base.ready || !mask.ready) throw new Error('strip');
    const fabrics = outfit.split(' ').map(style => FABRICS[style]);
    const tinted = recolorClothes(animPixels(base.img), animPixels(mask.img), fabrics);
    const canvas = document.createElement('canvas');
    canvas.width = tinted.width;
    canvas.height = tinted.height;
    canvas.getContext('2d').putImageData(tinted, 0, 0);
    animImages.delete(maskUrl); // 마스크는 칠할 때만 쓰므로 놓아 준다(브라우저가 메모리를 돌려받게)
    Object.assign(entry, { canvas, frames: Math.max(1, Math.round(tinted.width / ANIM_CELL.w)), ready: true });
  }).catch(() => { entry.failed = true; });
  return entry;
}

// 주인공 장비가 바뀌면 자주 쓰는 띠를 미리 칠해 둔다(처음 쓰는 순간 정지 그림이 끼지 않게)
const HERO_WARM = ['idle', 'run', 'hit', 'victory', 'down', 'getup', 'punch', 'kick', 'knee', 'throw', 'hold'];
let warmedOutfit = null;
function warmHero(sprite, outfit) {
  if (warmedOutfit === outfit) return;
  warmedOutfit = outfit;
  HERO_WARM.forEach((clip, index) => setTimeout(() => {
    if (warmedOutfit !== outfit) return;
    const smooth = smoothOn(sprite, 'boy', clip);
    const url = animUrl(sprite, 'boy', clip, false, smooth);
    if (!url) return;
    if (outfit) tintedStrip(sprite, 'boy', clip, url, outfit, smooth);
    else animImage(url);
  }, index * 40));
}

// ── 스프라이트마다 지금 상태 ──
const animStates = new Map();
let animStopUntil = 0;
// 반복·한 번 재생의 빠르기 배율(테스트 모드 동작 확인의 '느리게'에서 0.25)
let animTimeScale = 1;

// sprite에 지금 상태(pose)를 알린다. timing = 시간표 항목이면 { from, until, prev }, 그대로 머무는 상태면 null
function animate(sprite, pose, timing = null) {
  if (!sprite) return;
  let s = animStates.get(sprite);
  if (!s) {
    s = { phase: Math.random() * 4, segment: '', plan: null, from: 0, until: 0, canvas: null, drawn: '', on: false };
    animStates.set(sprite, s);
  }
  const id = sprite.dataset.sprite || '';
  const motion = sprite.closest('.arena')?.dataset.motion || '';
  const segment = `${id}|${pose}|${timing ? timing.from : 'rest'}|${motion}`;
  if (s.segment === segment) return;
  const restart = !timing && s.segment.split('|').slice(0, 2).join('|') !== `${id}|${pose}`;
  s.segment = segment;
  s.id = id;
  s.pose = pose;
  s.plan = animPlan(id, pose, timing?.prev ?? null, Boolean(timing), motion);
  if (timing) {
    s.from = timing.from;
    s.until = timing.until;
  } else {
    if (restart || !s.from) s.from = performance.now();
    s.until = 0;
  }
}

function animOff(sprite, s) {
  if (!s.on) return;
  s.on = false;
  s.drawn = '';
  sprite.classList.remove('anim-on');
}

// smoothClip = 매끄러운 띠의 동작 이름(원래 띠면 null). 계획의 칸 번호는 원래 띠 기준이라 매끄러운 띠의 칸으로 옮긴다:
//   여러 칸 구간은 끝 칸 뒤의 사이 칸까지(다음 상태로 끊기지 않게), 타격 칸 하나는 그 칸 그대로(타격 순간 고정),
//   타격 칸 바로 뒤에서 시작하는 마무리는 타격 칸 뒤 사이 칸부터, 반복은 마지막 → 첫 칸 사이 칸까지 돈다.
function animFrame(s, now, frames, smoothClip = null) {
  const [, first, end, mode, fps = 10] = s.plan;
  const k = smoothClip ? smoothK(smoothClip) : 0;
  const step = k + 1;
  const loopStrip = Boolean(smoothClip) && SMOOTH_LOOPS.includes(smoothClip);
  const base = step > 1 ? Math.round(loopStrip ? frames / step : (frames - 1) / step + 1) : frames;
  const lastBase = end < 0 ? base + end : Math.min(end, base - 1);
  const startBase = Math.min(first, lastBase);
  let start = startBase * step;
  let last = lastBase * step;
  if (step > 1) {
    if (lastBase === base - 1) last = loopStrip && mode === 'loop' ? frames - 1 : lastBase * step;
    else if (lastBase > startBase) last = lastBase * step + k;
    if (mode === 'span' && startBase > 0 && startBase - 1 === ANIM_IMPACT[smoothClip]) start = startBase * step - k;
  }
  const count = last - start + 1;
  const rate = (typeof motionRate === 'function' ? motionRate() : 1) * animTimeScale;
  if (mode === 'loop') return reducedMotion.matches ? start : start + Math.floor(now / 1000 * fps * step * Math.min(rate, 2) + s.phase * step) % count;
  if (mode === 'once') return start + Math.min(count - 1, Math.max(0, Math.floor((now - s.from) / 1000 * fps * step * rate)));
  if (!(s.until > s.from)) return last;
  const progress = Math.min(0.999, Math.max(0, (now - s.from) / (s.until - s.from)));
  return start + Math.floor(progress * count);
}

function drawAnim(sprite, s, now) {
  if (!s.plan) return animOff(sprite, s);
  const clip = s.plan[0];
  const smooth = smoothOn(sprite, s.id, clip);
  const url = animUrl(sprite, s.id, clip, false, smooth);
  if (!url) return animOff(sprite, s);
  const outfit = s.id === 'boy' ? sprite.dataset.outfit || '' : '';
  let source;
  let frames;
  if (outfit) {
    warmHero(sprite, outfit);
    const tinted = tintedStrip(sprite, s.id, clip, url, outfit, smooth);
    if (!tinted.ready) return animOff(sprite, s);
    source = tinted.canvas;
    frames = tinted.frames;
  } else {
    if (s.id === 'boy') warmHero(sprite, '');
    const strip = animImage(url);
    if (!strip.ready) return animOff(sprite, s);
    source = strip.img;
    frames = strip.frames;
  }
  const frame = animFrame(s, now, frames, smooth ? clip : null);
  if (smooth && s.lastClip && s.lastClip !== clip && s.canvas?.isConnected && !ANIM_BLEND_SKIP.includes(clip) && !reducedMotion.matches) {
    if (!s.fadeCanvas) {
      s.fadeCanvas = document.createElement('canvas');
      s.fadeCanvas.width = ANIM_CELL.w;
      s.fadeCanvas.height = ANIM_CELL.h;
    }
    const fade = s.fadeCanvas.getContext('2d');
    fade.clearRect(0, 0, ANIM_CELL.w, ANIM_CELL.h);
    fade.drawImage(s.canvas, 0, 0);
    s.fadeFrom = now;
  }
  s.lastClip = clip;
  // 타격 순간(strike)에는 겹쳐 지우기를 바로 끝낸다(공격 준비가 아주 짧을 때 타격 그림에 앞 동작이 겹쳐 보이지 않게)
  if (/(^|-)strike$/.test(s.pose || '')) s.fadeFrom = 0;
  const fadeAge = s.fadeFrom ? now - s.fadeFrom : Infinity;
  const fading = fadeAge < ANIM_BLEND_MS;
  if (!fading) s.fadeFrom = 0;
  const key = `${url}|${outfit}|${frame}${fading ? `|f${Math.floor(fadeAge / 12)}` : ''}`;
  if (s.drawn !== key) {
    if (!s.canvas || !s.canvas.isConnected) {
      s.canvas = sprite.querySelector('canvas.anim') || document.createElement('canvas');
      s.canvas.className = 'anim';
      s.canvas.width = ANIM_CELL.w;
      s.canvas.height = ANIM_CELL.h;
      s.canvas.setAttribute('aria-hidden', 'true');
      if (!s.canvas.isConnected) sprite.prepend(s.canvas);
      s.context = s.canvas.getContext('2d');
    }
    s.context.clearRect(0, 0, ANIM_CELL.w, ANIM_CELL.h);
    s.context.drawImage(source, frame * ANIM_CELL.w, 0, ANIM_CELL.w, ANIM_CELL.h, 0, 0, ANIM_CELL.w, ANIM_CELL.h);
    if (fading) {
      const left = 1 - fadeAge / ANIM_BLEND_MS;
      s.context.globalAlpha = left * left;
      s.context.drawImage(s.fadeCanvas, 0, 0);
      s.context.globalAlpha = 1;
    }
    s.drawn = key;
    s.frame = frame;
    s.frames = frames;
    // 칸 번호는 원래 띠 기준으로 알린다(매끄러운 띠의 사이 칸은 2.25처럼 소수)
    const step = smooth ? smoothK(clip) + 1 : 1;
    const label = frame / step;
    s.canvas.dataset.frame = `${s.id}:${clip}:${Number.isInteger(label) ? label : label.toFixed(2)}`;
    s.canvas.dataset.smooth = smooth ? '1' : '';
  }
  if (!s.on) {
    s.on = true;
    sprite.classList.add('anim-on');
  }
}

// 강타 순간: 모든 띠를 잠깐 멈추고(히트 스톱) 화면을 짧게 흔든다. 멈춤 길이는 배속에 맞춰 줄인다
function animImpact(strong) {
  if (!strong || reducedMotion.matches) return;
  const arena = document.getElementById('arena');
  const rate = typeof motionRate === 'function' ? motionRate() : 1;
  const stop = 70 / Math.min(rate, 3);
  animStopUntil = performance.now() + stop;
  arena.classList.add('hitstop');
  arena.classList.remove('shake');
  void arena.offsetWidth;
  arena.classList.add('shake');
  clearTimeout(animImpact.timer);
  clearTimeout(animImpact.shakeTimer);
  animImpact.timer = setTimeout(() => arena.classList.remove('hitstop'), stop);
  animImpact.shakeTimer = setTimeout(() => arena.classList.remove('shake'), 220);
}

// 화면 주사율로 돈다: hook(상태 → data-pose 갱신)을 부르고, 각 스프라이트의 지금 칸을 그린다
function startAnim(hook) {
  const tick = () => {
    const now = performance.now();
    try { hook?.(now); } catch (error) { console.error(error); }
    const stopped = now < animStopUntil;
    for (const [sprite, s] of animStates) {
      if (!sprite.isConnected) {
        animStates.delete(sprite);
        continue;
      }
      if (!stopped) drawAnim(sprite, s, now);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
