"""Render the site's score with claude-music (ACE-Step 1.5), then analyse, conform and encode.

Run from site/:
  uv run --python 3.12 --managed-python --with librosa --with soundfile scripts/render-score.py [cue ...]
  uv run ... scripts/render-score.py --conform [cue ...]   # re-cut existing renders, no GPU

For every cue it renders BATCH variants at 90 BPM in the target key, keeps the variant that
can be stretched cleanly and best matches the key, stretches it to exactly 90 BPM, cuts up to 16
bars from a downbeat, folds the tail onto the head for a seamless loop, and writes
public/score/<id>.m4a plus public/score/cues.json. The seed is recorded so a cue can be re-rendered.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

BPM = 90
BEATS_PER_BAR = 4
BATCH = 2
RENDER_SECONDS = 72  # room for a long intro before the groove
LOOP_BARS = (16, 12, 8)  # longest loop that fits after a downbeat wins
SR = 44100
XFADE_SECONDS = 0.25
TARGET_RMS_DB = -20.0
PEAK_DB = -2.0
MAX_STRETCH = 0.06
ENGINE = Path.home() / '.claude/skills/claude-music/scripts/music_engine.sh'
SOURCE_DIR = Path.home() / 'Music/claude-music-output'
OUT = Path(__file__).resolve().parent.parent / 'public' / 'score'

# The score: a key map that walks the circle of fifths and back. A is in every key,
# so the site's A pedal bridges each change. Captions follow claude-music's prompt guide.
CUES = {
    'opening': ('D minor', 'cinematic minimalist solo felt piano, intimate, late night studio, soft room tone, sparse gentle four-note motif, reflective, instrumental'),
    'ch-01': ('D minor', 'downtempo electronic in a minor key, dark warm analog synth arpeggio, deep sub bass, soft drum machine, vinyl crackle, late night studio, melancholic, cinematic, instrumental'),
    'ch-02': ('A minor', 'lo-fi hip hop instrumental, chopped dusty piano samples, boom bap drums, vinyl crackle, tape saturation, nostalgic bedroom producer'),
    'ch-03': ('E minor', 'cinematic documentary score, shortwave radio static textures, Rhodes electric piano, solo cello, steady piano pulse, curious, investigative, instrumental'),
    'ch-04': ('G major', 'playful cinematic underscore, pizzicato strings, marimba, light percussion, bright, optimistic, building momentum, instrumental'),
    'ch-05': ('D major', 'chamber ensemble counterpoint, piano, cello, clarinet, pizzicato strings, marimba, busy and warm, five interweaving voices, instrumental'),
    'ch-06': ('A minor', 'Indian classical fusion in dorian mode, tanpura drone, tabla, santoor, bansuri flute, rhythmic train groove, Mumbai nights, warm, nostalgic, instrumental'),
    'ch-07': ('D minor', 'cinematic electronic orchestral, dense layered strings, synth pulses, deep percussion, focused, minimal techno undertone, instrumental'),
    'ch-08': ('F major', 'uplifting cinematic strings and piano, warm, hopeful, new beginning, gentle swells, instrumental'),
    'pattern': ('D major', 'cinematic orchestral resolution, piano motif, warm strings, soft brass, glockenspiel, gentle and triumphant, instrumental'),
    'door': ('F major', 'solo piano, intimate and warm, like a handwritten letter, soft, slow, instrumental'),
    'close': ('D major', 'cinematic minimalist solo felt piano with soft string pad, resolved, warm, end credits, instrumental'),
}

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def detect_key(y):
    """Krumhansl-Schmuckler on mean chroma. Returns (best key name, correlation per key)."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR).mean(axis=1)
    scores = {}
    for i, note in enumerate(NOTES):
        scores[f'{note} major'] = np.corrcoef(chroma, np.roll(MAJOR, i))[0, 1]
        scores[f'{note} minor'] = np.corrcoef(chroma, np.roll(MINOR, i))[0, 1]
    return max(scores, key=scores.get), scores


def analyse(path, seed, target_key):
    y, _ = librosa.load(path, sr=SR, mono=True)
    _, beats = librosa.beat.beat_track(y=y, sr=SR, start_bpm=BPM)
    if len(beats) < 4 * BEATS_PER_BAR:
        raise ValueError(f'{Path(path).name}: only {len(beats)} beats found')
    times = librosa.frames_to_time(beats, sr=SR)
    # A line through every beat, so 11.6ms frame snapping averages out. Rounding each gap
    # to the median first means a missed beat counts as two, not as one slow beat.
    gaps = np.diff(times)
    index = np.concatenate([[0], np.cumsum(np.maximum(1, np.round(gaps / np.median(gaps))))])
    tracked = 60 / float(np.polyfit(index, times, 1)[0])
    tempo = tracked
    for factor in (0.5, 2.0):  # half or double time still sits on the same grid
        if abs(tracked * factor - BPM) < abs(tempo - BPM):
            tempo = tracked * factor
    per_bar = max(1, round(BEATS_PER_BAR * tracked / tempo))
    # Downbeat guess: the beat phase whose low end hits hardest (kick or bass note on beat one).
    low = librosa.onset.onset_strength(y=y, sr=SR, fmax=200, n_mels=16)
    phase = max(range(per_bar), key=lambda k: low[beats[k::per_bar]].mean())
    key, scores = detect_key(y)
    return {'path': path, 'seed': seed, 'bpm': tempo, 'key': key, 'fit': float(scores[target_key]),
            'downbeats': times[phase::per_bar].tolist()}


def render(cue_id, key, caption):
    cmd = ['bash', str(ENGINE), '--quality', 'standard', '--format', 'wav', '--batch', str(BATCH), 'generate',
           '--caption', caption, '--instrumental', '--duration', str(RENDER_SECONDS),
           '--bpm', str(BPM), '--key', key, '--time-sig', str(BEATS_PER_BAR)]
    print(f'[{cue_id}] rendering {BATCH} variants in {key}', flush=True)
    # The engine runs inside ACE-Step's own venv, not this script's.
    # UV_NO_SYNC: the env is already installed; re-resolving online mid-batch can time out and kill a render.
    env = {k: v for k, v in os.environ.items() if k != 'VIRTUAL_ENV'} | {'UV_NO_SYNC': '1'}
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise RuntimeError(f'engine failed\n{result.stderr[-2000:]}')
    data = json.loads(result.stdout)
    if not data.get('success'):
        raise RuntimeError(f'engine reported failure: {data}')
    return [(o['path'], o['seed']) for o in data['outputs']]


def stretchable(c):
    return abs(BPM / c['bpm'] - 1) < MAX_STRETCH


def conform(cue_id, best):
    """Stretch to exactly BPM, cut BARS bars from a downbeat, fold the tail onto the head, encode."""
    if not stretchable(best):
        raise ValueError(f"tempo {best['bpm']:.1f} too far from {BPM}; re-render")
    stretch = BPM / best['bpm']
    tmp = OUT / f'.{cue_id}.wav'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', best['path'],
                    '-af', f'atempo={stretch:.5f}', '-ar', str(SR), str(tmp)], check=True)
    audio, _ = sf.read(tmp, always_2d=True)

    x = int(XFADE_SECONDS * SR)
    starts = [int(d / stretch * SR) for d in best['downbeats'] if d >= 1.0]
    fit = next(((bars, s) for bars in LOOP_BARS for s in starts
                if s + int(bars * BEATS_PER_BAR * 60 / BPM * SR) + x <= len(audio)), None)
    if fit is None:
        raise ValueError('not enough audio after a downbeat for even the shortest loop')
    bars, start = fit
    n = int(bars * BEATS_PER_BAR * 60 / BPM * SR)

    loop = audio[start:start + n].copy()
    tail = audio[start + n:start + n + x]
    fade_in = np.sqrt(np.linspace(0, 1, x))[:, None]
    loop[:x] = loop[:x] * fade_in + tail * np.sqrt(1 - fade_in ** 2)  # equal-power seam

    gain = 10 ** (TARGET_RMS_DB / 20) / max(np.sqrt(np.mean(loop ** 2)), 1e-9)
    peak_limit = 10 ** (PEAK_DB / 20)
    gain = min(gain, peak_limit / max(np.abs(loop).max(), 1e-9))
    sf.write(tmp, loop * gain, SR, subtype='PCM_16')

    out = OUT / f'{cue_id}.m4a'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(tmp), '-c:a', 'aac', '-b:a', '128k',
                    '-movflags', '+faststart', str(out)], check=True)
    tmp.unlink()
    return out, bars


def source_for(seed):
    matches = sorted(SOURCE_DIR.glob(f'*_s{seed}.wav'))
    if not matches:
        raise FileNotFoundError(f'no render with seed {seed} in {SOURCE_DIR}')
    return str(matches[-1])


def main():
    args = sys.argv[1:]
    conform_only = '--conform' in args
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / 'cues.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
        'bpm': BPM, 'beatsPerBar': BEATS_PER_BAR, 'cues': {}}
    wanted = [a for a in args if a != '--conform'] or (list(manifest['cues']) if conform_only else list(CUES))

    failed = []
    for cue_id in wanted:
        key, caption = CUES[cue_id]
        try:
            if conform_only:
                seed = manifest['cues'][cue_id]['seed']
                best = analyse(source_for(seed), seed, key)
            else:
                candidates = [analyse(p, seed, key) for p, seed in render(cue_id, key, caption)]
                for c in candidates:
                    print(f"  seed {c['seed']}: {c['bpm']:.1f} BPM, heard {c['key']}, fit {c['fit']:.2f}", flush=True)
                usable = [c for c in candidates if stretchable(c)] or candidates
                best = max(usable, key=lambda c: (c['key'] == key, c['fit']))
            out, bars = conform(cue_id, best)
        except Exception as err:  # one bad cue shouldn't cost the rest of the batch
            print(f'[{cue_id}] FAILED: {err}', flush=True)
            failed.append(cue_id)
            continue
        manifest['cues'][cue_id] = {'file': out.name, 'bars': bars, 'key': key, 'seed': best['seed']}
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        print(f"[{cue_id}] kept seed {best['seed']} ({best['bpm']:.2f} BPM, heard {best['key']}, {bars} bars) -> {out.name}", flush=True)

    if failed:
        print(f'Failed: {" ".join(failed)}', flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
