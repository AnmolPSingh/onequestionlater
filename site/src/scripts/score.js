// The soundtrack is my own track, Reverie, looping. It's on by default and fades up from silence.
// Browsers won't start sound until someone clicks, taps or presses a key on the page, so if the
// first try is refused the fade starts at that first gesture. An analyser feeds the particles.
const TRACK_URL = '/score/reverie.mp3';
const VOLUME = 0.35;
const FADE_IN_SECONDS = 8;
const SUSPEND_AFTER_MS = 900;
const LOW_BINS = [0, 5];
const HIGH_BINS = [28, 110];
const MUTED_KEY = 'sound-off';
const GESTURES = ['pointerdown', 'keydown'];

const average = (bins, [from, to]) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += bins[i];
  return sum / ((to - from) * 255);
};

const remembered = () => { try { return localStorage.getItem(MUTED_KEY) === '1'; } catch { return false; } };
const remember = (off) => { try { localStorage.setItem(MUTED_KEY, off ? '1' : '0'); } catch { /* private mode: it just asks again next visit */ } };

export function createScore() {
  const audio = new Audio(TRACK_URL);
  audio.loop = true;
  audio.preload = 'none';

  let ctx = null;
  let gain = null;
  let analyser = null;
  let bins = null;
  let on = false;
  let music = null; // the track, ducked under the static while the dial is searching
  let hiss = null;
  let tuned = 0;

  const boot = () => {
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    bins = new Uint8Array(analyser.frequencyBinCount);
    music = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(analyser);
    analyser.connect(music).connect(gain).connect(ctx.destination);
    // Radio static, made here rather than downloaded: two seconds of noise, looped and band-passed to sound like a dial.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2600;
    band.Q.value = 0.6;
    hiss = ctx.createGain();
    hiss.gain.value = 0;
    source.connect(band).connect(hiss).connect(gain);
    source.start();
  };

  return {
    // 0..1: how lost the dial is. The track drops away under static, and comes back as the voice arrives.
    tune(amount) {
      if (!ctx || Math.abs(amount - tuned) < 0.01) return;
      tuned = amount;
      music.gain.setTargetAtTime(1 - amount * 0.85, ctx.currentTime, 0.12);
      hiss.gain.setTargetAtTime(amount * 0.22, ctx.currentTime, 0.12);
    },
    // 0..1 loudness of the bass and the highs. Both are 0 while silent.
    levels() {
      if (!on || !analyser) return { low: 0, high: 0 };
      analyser.getByteFrequencyData(bins);
      return { low: average(bins, LOW_BINS), high: average(bins, HIGH_BINS) };
    },

    init(toggle, isCalm) {
      const label = toggle.querySelector('[data-sound-label]');
      const show = (value, text) => {
        on = value;
        document.documentElement.classList.toggle('sound-on', on);
        label.textContent = text;
      };

      const start = async () => {
        if (on) return true;
        if (!ctx) boot();
        try {
          await audio.play();
          await ctx.resume();
        } catch {
          return false; // not allowed yet, or the file failed: the site carries on silent
        }
        show(true, 'Sound on');
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(VOLUME, now + FADE_IN_SECONDS);
        return true;
      };

      const onGesture = async (event) => {
        if (toggle.contains(event.target) || isCalm()) return; // the toggle speaks for itself; reduced motion stays silent
        disarm();
        if (!await start()) show(false, 'Sound off');
      };
      const disarm = () => GESTURES.forEach((name) => removeEventListener(name, onGesture));

      toggle.hidden = false;
      toggle.addEventListener('click', async () => {
        disarm();
        if (on) {
          show(false, 'Sound off');
          remember(true);
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
          // Pause once faded, so phones release the audio session.
          setTimeout(() => { if (!on) { audio.pause(); ctx.suspend(); } }, SUSPEND_AFTER_MS);
          return;
        }
        remember(false);
        if (!await start()) show(false, 'Sound off');
      });

      document.addEventListener('visibilitychange', () => {
        if (!on) return;
        if (document.hidden) audio.pause();
        else audio.play().catch(() => show(false, 'Sound off'));
      });

      if (remembered() || isCalm()) return;
      const invite = matchMedia('(hover: none)').matches ? 'Tap for sound' : 'Click for sound';
      show(false, innerWidth < 420 ? 'Sound off' : invite); // a phone's header has no room for the longer label
      start().then((started) => { if (!started) GESTURES.forEach((name) => addEventListener(name, onGesture)); });
    },
  };
}
