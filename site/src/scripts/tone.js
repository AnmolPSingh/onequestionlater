// The tone that shapes the sand: a quiet sine with a soft overtone, gliding to each beat's frequency as
// the figure changes, so you hear what you see. The noise beat is band-passed hiss instead. It sounds only
// while the site's sound is on (html.sound-on, set by score.js), layered under Reverie, and fades with it.
const VOLUME = 0.045;
const HISS = 0.03;
const GLIDE = 0.6; // seconds to slide to a new frequency
const FADE = 0.8;

export function createTone() {
  let ctx = null;
  let osc = null;
  let over = null;
  let level = null;
  let hiss = null;
  let hz = 0;
  let was = '';

  const boot = () => {
    ctx = new AudioContext();
    level = ctx.createGain();
    level.gain.value = 0;
    level.connect(ctx.destination);
    osc = ctx.createOscillator();
    osc.type = 'sine';
    over = ctx.createOscillator();
    over.type = 'sine';
    const overGain = ctx.createGain();
    overGain.gain.value = 0.18; // the octave above, faint, so the tone has a little body
    osc.connect(level);
    over.connect(overGain).connect(level);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400;
    band.Q.value = 0.7;
    hiss = ctx.createGain();
    hiss.gain.value = 0;
    source.connect(band).connect(hiss).connect(ctx.destination);
    osc.start();
    over.start();
    source.start();
  };

  return {
    // Called every frame: the beat's frequency (0 for noise) and whether the site's sound is on.
    play(next, on) {
      if (!on && !ctx) return;
      const state = `${on}:${next}`;
      if (state === was) return; // only schedule when something changes, not every frame
      was = state;
      if (!ctx) boot();
      if (ctx.state === 'suspended' && on) ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const noisy = next === 0;
      level.gain.setTargetAtTime(on && !noisy ? VOLUME : 0, now, FADE / 3);
      hiss.gain.setTargetAtTime(on && noisy ? HISS : 0, now, FADE / 3);
      if (next && next !== hz) {
        hz = next;
        osc.frequency.setTargetAtTime(hz, now, GLIDE / 3);
        over.frequency.setTargetAtTime(hz * 2, now, GLIDE / 3);
      }
    },
  };
}
