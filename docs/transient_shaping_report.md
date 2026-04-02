# Algorithmic Transient Shaping: A Comprehensive Technical Design Report

**Version 1.0 — Internal Engineering Reference**
**Audience:** DSP engineers, audio plugin developers, product designers

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Conceptual Foundations](#2-conceptual-foundations)
3. [DSP Methods Taxonomy](#3-dsp-methods-taxonomy)
4. [Mathematical / Signal-Level Explanation](#4-mathematical--signal-level-explanation)
5. [Realtime Implementation Design](#5-realtime-implementation-design)
6. [Multiband Design Deep Dive](#6-multiband-design-deep-dive)
7. [Artifact Prevention & Robustness](#7-artifact-prevention--robustness)
8. [Architecture Recommendations](#8-architecture-recommendations)
9. [Pseudocode / Implementation Blueprint](#9-pseudocode--implementation-blueprint)
10. [Evaluation Plan](#10-evaluation-plan)
11. [Product / UX Guidance](#11-product--ux-guidance)
12. [Final Recommendation](#12-final-recommendation)
13. [Stretch Topics](#13-stretch-topics)

---

## 1. Executive Summary

### What Transient Shaping Is

Transient shaping is a dynamics process that independently adjusts the *attack* (onset) and *sustain* (body/tail) portions of audio events without requiring a threshold. Unlike compressors, gates, and expanders — which respond to *level* — a transient shaper responds to the *rate of change* of the signal envelope. This makes it a fundamentally different tool: it reshapes the temporal profile of sounds rather than controlling their overall loudness.

### How It Works at a High Level

The core operation is: detect whether the signal is currently in an "attack" phase (energy rising rapidly) or a "sustain" phase (energy relatively stable or decaying), then apply differential gain to each phase. The canonical approach uses two envelope followers with different time constants — one fast-responding, one slow-responding — and derives a transient signal from their difference or ratio. This transient signal drives a gain stage that boosts or cuts the onset portion of audio events.

### Major Implementation Paths

There are three broad families of approach:

1. **Dual-envelope difference methods** — the most common, used in SPL Transient Designer–style designs. Two envelope followers with asymmetric time constants produce a differential signal that isolates transients. Simple, low-CPU, well-understood.

2. **Energy-flux / derivative methods** — compute the time derivative of signal energy or spectral content. More theoretically grounded, better at distinguishing true onsets from slow swells, but more expensive and harder to tune.

3. **Spectral / filterbank methods** — decompose the signal into frequency bands and detect transients per-band or across bands. Enables multiband transient shaping and more precise control, at the cost of latency and complexity.

### Recommended Design for a Real-Time Multiband Transient Shaper

For a first production implementation, we recommend a **3-band Linkwitz-Riley IIR crossover** with **per-band dual-envelope transient detection**, a shared full-band sidechain option for coherence, gain smoothing via exponential ramps, and a lookahead of 1–3 ms. This design balances sonic quality, CPU efficiency, zero-phase-error recombination (using LR4 complementary crossovers), and low enough latency for live use.

---

## 2. Conceptual Foundations

### 2.1 Transient vs. Sustain vs. Decay vs. Body

These terms describe temporal segments of a sound event, though their boundaries are not sharply defined:

**Transient (Attack):** The initial onset portion where energy rises rapidly. In a drum hit, this is the first 1–20 ms containing the sharp initial impact. In a plucked guitar note, it is the first few milliseconds of the pick strike. Transients are spectrally broad — they contain energy across a wide frequency range simultaneously — and are perceptually responsible for the sense of "punch," "snap," and clarity.

**Sustain (Body):** The portion following the transient where energy is relatively stable or decaying slowly. A sustained organ note has nearly all sustain. A snare drum has brief sustain (the resonance of the shell and snares ringing). Sustain carries the tonal character, pitch information, and harmonic content of a sound.

**Decay:** The tail portion where energy is fading toward silence. In reverberant recordings, decay includes room reflections and reverb tails. Musically, decay carries spatial information and ambiance.

**Body:** An informal term often used interchangeably with sustain, but sometimes referring specifically to the mid-frequency tonal core of a sound, excluding both the sharp transient and the reverberant decay.

For transient shaper design, the operationally useful distinction is binary: **transient phase** (energy rising faster than a threshold rate) vs. **non-transient phase** (everything else). The "sustain" control in most transient shapers actually operates on the non-transient phase, which includes both sustain and decay.

### 2.2 Psychoacoustic Effect of Transient Manipulation

Boosting transients produces a perception of increased "punch," "presence," "articulation," and "closeness." The effect is disproportionately powerful because human auditory perception is heavily weighted toward onsets — the auditory system uses onset information for source localization, source identification, and rhythmic parsing.

Reducing transients produces a perception of "softness," "distance," "smoothness," and "pushed-back" placement. A drum bus with reduced transients can sound like it was recorded farther from the kit, even though the tonal character is unchanged.

Boosting sustain increases the perceived "body," "fatness," "room sound," and duration of notes. Reducing sustain tightens the sound, making it more staccato and dry.

These effects are *not* equivalent to EQ or compression, even when they seem sonically similar:

- **EQ** changes the spectral balance uniformly across time. Transient shaping changes the temporal envelope without altering steady-state spectral balance.
- **Compression** responds to level and applies gain reduction proportionally. It affects transients and sustain together — a fast compressor will squash transients, but it also changes the sustain level and introduces pumping. A transient shaper can boost transients without any change to the sustain level, or reduce sustain without touching the transient at all.
- **Gating** is a binary on/off process that removes content below a threshold. Transient shaping is a continuous, proportional process that reshapes the envelope contour.

### 2.3 Differentiation from Related Processes

| Process | Trigger | Action | Threshold Required | Time-Dependent |
|---|---|---|---|---|
| Compression | Level exceeds threshold | Reduce gain | Yes | No (level-based) |
| Expansion | Level below threshold | Reduce gain further | Yes | No |
| Gating | Level below threshold | Mute or heavily attenuate | Yes | No |
| Limiting | Level exceeds ceiling | Hard gain reduction | Yes | No |
| Saturation | Waveform amplitude | Nonlinear waveshaping | Implicit | No |
| Envelope following | Signal level | Track envelope | No | Partially |
| **Transient shaping** | **Rate of envelope change** | **Differential gain to attack vs. sustain** | **No** | **Yes** |

The defining characteristic of transient shaping is **threshold-free, rate-of-change-driven operation**. This is why transient shapers are often described as "program-independent" — they respond to the *shape* of the signal, not its absolute level.

### 2.4 Common Use Cases

**Drums and Percussion:** The most common application. Adding attack to a kick drum for more beater click, adding sustain to a snare for more body, reducing attack on overheads to soften harsh cymbal transients, tightening room mics by reducing sustain.

**Full Mix Bus:** Subtle transient enhancement can add perceived clarity and "forward" energy to a mix without changing levels. Sustain reduction can tighten a mix that sounds washy or reverberant.

**Bass Guitar/Synth Bass:** Attack enhancement brings out finger/pick articulation. Sustain control shapes the note envelope.

**Vocals:** Subtle attack enhancement can add presence and intelligibility. Usually requires more care to avoid artifacts on sibilants.

**Guitar:** Attack enhancement brings out pick definition. Sustain enhancement can fatten clean guitar tones.

**Sound Design:** Extreme transient shaping creates unnatural envelopes useful for electronic music, foley, and cinematic effects.

---

## 3. DSP Methods Taxonomy

### 3.1 Dual-Envelope Difference Method

**How it works:** Two envelope followers track the signal amplitude — one with fast attack/release (responding quickly to transients) and one with slow attack/release (tracking the average level). The difference between the fast and slow envelopes produces a positive signal during transient events and a near-zero or negative signal during sustain. This differential signal is scaled and used to modulate gain.

**Strengths:** Very simple to implement. Low CPU cost. Well-understood behavior. The SPL Transient Designer — the original hardware transient shaper and still the most recognized — uses a variant of this approach. Intuitive parameter mapping: fast envelope time controls sensitivity, slow envelope time controls the definition of "sustain."

**Weaknesses:** The differential signal is imprecise — it depends heavily on the ratio of time constants. If the fast envelope is too fast, it tracks individual waveform cycles rather than the envelope, causing distortion. If the slow envelope is too slow, it fails to track gradual level changes and produces false transient signals on swells. The method cannot distinguish between a true onset and any rapid level change (e.g., a volume automation step).

**Realtime suitability:** Excellent. Sample-by-sample processing with minimal state. Typical CPU cost is negligible.

**Sonic character:** Smooth, musical. The gradual ramp-up and ramp-down of the differential gain avoids hard edges. Can sound slightly soft or imprecise on very fast transients.

**Complexity:** Low.

### 3.2 Detector/Comparator Method (Peak vs. RMS)

**How it works:** A peak-detecting envelope follower and an RMS-computing envelope follower are run in parallel. The peak follower responds to instantaneous maxima; the RMS follower tracks average power. When peak significantly exceeds RMS (by a ratio or dB threshold), the signal is classified as being in a transient phase. This classification drives a gain modulation stage.

**Strengths:** More robust distinction between transient and sustain than the pure dual-envelope method. The peak/RMS ratio is a well-defined metric with physical meaning (it approximates the crest factor over a local window). Less sensitive to time-constant tuning.

**Weaknesses:** RMS computation requires either a running sum (block-based, introduces latency) or a leaky integrator approximation (introduces time-constant sensitivity). The peak/RMS ratio can be noisy on low-level signals. Binary classification (transient/not-transient) requires a threshold on the ratio, reintroducing a threshold parameter.

**Realtime suitability:** Good. The leaky-integrator RMS approximation is sample-by-sample and cheap. True windowed RMS adds a small buffer requirement.

**Sonic character:** Cleaner transient detection than pure dual-envelope. Can sound more "surgical" or "digital" if the classification boundary is too sharp.

**Complexity:** Low to medium.

### 3.3 Derivative / Slope Method

**How it works:** Compute the time derivative (first difference) of the signal envelope or energy. A positive derivative indicates rising energy (transient phase); near-zero or negative derivative indicates sustain or decay. The magnitude of the derivative can be used to scale the gain — stronger onsets get more boost.

**Strengths:** Mathematically direct representation of "rate of change." Naturally threshold-free. Responds proportionally to onset strength. Can be combined with second-derivative analysis to detect the *start* and *end* of transients more precisely.

**Weaknesses:** Derivatives amplify high-frequency noise. The raw derivative of a noisy or distorted signal will be very noisy, requiring pre-smoothing. The derivative of the envelope (rather than the raw signal) is needed, so this method still depends on an envelope follower. Negative derivatives (decay phases) need separate handling.

**Realtime suitability:** Good, if the derivative is computed on a smoothed envelope rather than the raw signal.

**Sonic character:** Responsive, precise. Can sound aggressive or "spiky" if the derivative is not adequately smoothed.

**Complexity:** Low to medium.

### 3.4 Energy Flux Method

**How it works:** Compute the short-term energy of the signal in successive overlapping windows (typically 2–10 ms). The *energy flux* is the ratio or difference of energy between consecutive windows. A high positive energy flux indicates a transient onset. This is closely related to the derivative method but operates on energy (squared amplitude) rather than amplitude, giving it better sensitivity to true acoustic onsets.

**Strengths:** Well-studied in the MIR (music information retrieval) literature for onset detection. More robust than amplitude-derivative methods because squaring emphasizes large excursions and de-emphasizes small noise fluctuations. Can be computed in the spectral domain as *spectral flux* for even better onset discrimination.

**Weaknesses:** Requires windowed computation, introducing latency equal to at least one window length. More CPU-intensive than simple envelope methods. The window size is a critical parameter: too short and it tracks waveform detail; too long and it smears transients.

**Realtime suitability:** Good with small windows (2–5 ms). Latency of one window length is usually acceptable.

**Sonic character:** Precise, clean transient detection. Less prone to false positives on slow swells.

**Complexity:** Medium.

### 3.5 Spectral Flux Method

**How it works:** Perform a short-time Fourier transform (STFT) on successive overlapping windows. Compute the spectral flux as the sum of positive differences in magnitude across frequency bins between consecutive frames. High spectral flux indicates a transient (broad spectral change), while tonal changes (e.g., a new note in a melodic line) produce lower, more localized spectral flux.

**Strengths:** The gold standard for onset detection in MIR. Can distinguish true percussive onsets from tonal changes, pitch bends, and amplitude swells. Per-frequency-bin information enables frequency-selective transient detection.

**Weaknesses:** Requires STFT, introducing latency of at least one hop size (typically 5–20 ms). Significant CPU cost. Overlap-add reconstruction for resynthesis adds complexity. Phase handling is nontrivial. Not well-suited for zero-latency or ultra-low-latency use.

**Realtime suitability:** Moderate. Acceptable for studio plugins with declared latency; not ideal for live monitoring.

**Sonic character:** Very precise, highly discriminating. Can sound "transparent" or "surgical."

**Complexity:** High.

### 3.6 Filterbank / Subband Method

**How it works:** Split the signal into multiple frequency bands using a filterbank (IIR crossovers, FIR filterbank, or wavelet decomposition). Detect transients independently in each band. Apply per-band gain modulation. Recombine.

**Strengths:** Enables multiband transient shaping — the primary motivation. Allows different transient treatment for low, mid, and high frequencies (e.g., boost kick attack without boosting hi-hat fizz). Per-band detection is more accurate because transient characteristics vary by frequency range.

**Weaknesses:** Crossover design affects phase coherence. IIR crossovers introduce phase distortion (usually inaudible with Linkwitz-Riley designs). FIR/linear-phase crossovers introduce latency. Recombination can produce artifacts at crossover frequencies if gain modulation differs sharply between adjacent bands. More parameters to tune.

**Realtime suitability:** Good with IIR crossovers (zero additional latency). FIR crossovers add latency proportional to filter order.

**Sonic character:** More controlled and frequency-aware than broadband. Can sound more "natural" because bass and treble transients are handled differently.

**Complexity:** Medium to high, depending on band count and crossover type.

### 3.7 Adaptive / Program-Dependent Methods

**How it works:** Dynamically adjust the detection parameters (time constants, thresholds, sensitivity) based on the statistical properties of the incoming signal. For example, if the signal has high density of transients (fast drum pattern), increase the release speed to avoid inter-transient pumping. If the signal is mostly sustained (pad), reduce sensitivity to avoid false triggers on noise.

**Strengths:** More robust across diverse material. Reduces the need for manual parameter adjustment. Can sound more "intelligent" and musical.

**Weaknesses:** Adds complexity and state. The adaptation logic itself needs careful design to avoid instability or hunting behavior. Hard to make predictable — users may not understand why the effect sounds different on different material.

**Realtime suitability:** Good, though the adaptation computation adds modest CPU cost.

**Sonic character:** Potentially more musical and less prone to artifacts, but behavior is less predictable.

**Complexity:** Medium to high.

### 3.8 Summary Comparison Table

| Method | CPU Cost | Latency | Precision | Robustness | Complexity | Best For |
|---|---|---|---|---|---|---|
| Dual-envelope difference | Very low | 0 | Moderate | Moderate | Low | V1 / broadband |
| Peak vs. RMS comparator | Low | 0–2 ms | Good | Good | Low–Med | Broadband, clean detection |
| Derivative / slope | Low | 0 | Good | Moderate | Low–Med | Responsive broadband |
| Energy flux | Medium | 2–5 ms | Very good | Very good | Medium | Studio quality |
| Spectral flux | High | 5–20 ms | Excellent | Excellent | High | Premium / analysis |
| Filterbank / subband | Medium | 0–10 ms | Good | Good | Med–High | Multiband |
| Adaptive | +20% over base | Varies | Good | Very good | Med–High | Program-dependent |

---

## 4. Mathematical / Signal-Level Explanation

### 4.1 Envelope Follower Design

The envelope follower is the foundational building block. Its job is to produce a smooth, non-negative signal that tracks the amplitude contour of the input.

**Rectification stage:**

```
x_rect[n] = |x[n]|          (full-wave rectification)
```

or

```
x_rect[n] = x[n]^2          (squared / energy rectification)
```

Squared rectification is preferable for transient detection because it emphasizes peaks relative to low-level content and produces a smoother envelope.

**Smoothing stage (asymmetric first-order IIR):**

```
if x_rect[n] > env[n-1]:
    env[n] = α_attack * env[n-1] + (1 - α_attack) * x_rect[n]
else:
    env[n] = α_release * env[n-1] + (1 - α_release) * x_rect[n]
```

where the smoothing coefficients are derived from the desired time constants:

```
α = exp(-1 / (τ * fs))
```

Here `τ` is the time constant in seconds and `fs` is the sample rate. A time constant of 1 ms at 44.1 kHz gives `α ≈ 0.9775`. A time constant of 100 ms gives `α ≈ 0.99977`.

**Critical design note:** The choice of rectification (absolute value vs. squared) affects the dynamic range of the envelope and the sensitivity of the transient detector. Squared rectification produces envelopes with wider dynamic range, making transient/sustain separation easier but also amplifying noise-floor modulation. For transient shaping, squared rectification followed by square-root conversion back to amplitude domain is recommended.

### 4.2 Dual-Envelope Transient Estimation

Define two envelopes:

```
env_fast[n]:  attack τ = 0.1–1 ms,   release τ = 5–20 ms
env_slow[n]:  attack τ = 10–50 ms,   release τ = 50–200 ms
```

The transient signal is:

```
transient[n] = env_fast[n] - env_slow[n]
```

When the signal has a sharp onset, `env_fast` rises quickly while `env_slow` lags behind, producing a positive `transient` value. During sustain, both envelopes converge and the difference approaches zero. During decay, `env_fast` drops faster than `env_slow`, producing a negative difference — this can be used as a sustain-phase indicator.

**Normalized form:**

```
transient_norm[n] = (env_fast[n] - env_slow[n]) / max(env_slow[n], ε)
```

Normalization by the slow envelope makes the transient signal level-independent — a quiet snare hit produces the same normalized transient signal as a loud one. The epsilon `ε` prevents division by zero (typical value: 1e-8 or -160 dBFS).

### 4.3 Sustain Estimation

The sustain signal is simply the complement of the transient signal in several possible formulations:

**Method A — Slow envelope as sustain proxy:**

```
sustain[n] = env_slow[n]
```

This is the simplest approach. The slow envelope naturally represents the average level, which is dominated by the sustain portion.

**Method B — Moving average subtraction:**

Compute a moving average of the absolute signal over a window of 20–100 ms. This represents the "sustain floor." The portion of the envelope that exceeds this floor is the transient; the floor itself is the sustain estimate.

**Method C — Gated sustain:**

Use the transient detector output to gate the signal:

```
if transient_norm[n] > threshold:
    phase = ATTACK
else:
    phase = SUSTAIN
```

The gain for the sustain control is applied only during the SUSTAIN phase. This is more binary and can produce audible switching artifacts if not smoothed.

### 4.4 Gain Generation

The transient and sustain signals drive separate gain stages:

```
gain_attack[n]  = 1 + attack_amount * clamp(transient_norm[n], 0, 1)
gain_sustain[n] = 1 + sustain_amount * clamp(-transient_norm[n], 0, 1)
```

Or in dB domain:

```
gain_dB[n] = attack_dB * clamp(transient_norm[n], 0, 1)
           + sustain_dB * (1 - clamp(transient_norm[n], 0, 1))
```

where `attack_dB` and `sustain_dB` are the user-controlled gain amounts (positive = boost, negative = cut).

The combined gain is:

```
gain_total[n] = gain_attack[n] * gain_sustain[n]
```

### 4.5 Gain Smoothing

Raw gain modulation produces clicks and zipper noise. The gain signal must be smoothed:

```
gain_smooth[n] = β * gain_smooth[n-1] + (1 - β) * gain_total[n]
```

The smoothing coefficient `β` should be relatively fast (τ = 0.5–2 ms) to preserve the intended transient shaping but slow enough to prevent clicks. A useful technique is **asymmetric gain smoothing** — faster attack on the gain (to respond to transients quickly) and slower release (to avoid choppy gain reduction):

```
if gain_total[n] > gain_smooth[n-1]:
    β = β_fast    (τ = 0.1–0.5 ms)
else:
    β = β_slow    (τ = 1–5 ms)
```

### 4.6 Wet/Dry Application

The final output is:

```
y[n] = gain_smooth[n] * x_delayed[n]
```

where `x_delayed[n]` is the input delayed by the lookahead amount (if any). A wet/dry mix control is standard:

```
y[n] = mix * (gain_smooth[n] * x_delayed[n]) + (1 - mix) * x_delayed[n]
     = (mix * gain_smooth[n] + (1 - mix)) * x_delayed[n]
     = (1 + mix * (gain_smooth[n] - 1)) * x_delayed[n]
```

### 4.7 Optional Safety Limiting

Transient boosting can produce peaks that exceed 0 dBFS. A soft limiter or clipper after the gain stage prevents digital clipping:

```
if |y[n]| > ceiling:
    y[n] = sign(y[n]) * soft_clip(|y[n]|, ceiling, knee)
```

A simple soft-clip function:

```
soft_clip(x, c, k) =
    x,                           if x < c - k
    c - (c - x + k)^2 / (4*k),  if c - k <= x <= c + k
    c,                           if x > c + k
```

This is optional but strongly recommended for any plugin that may be used on peaks-normalized material.

---

## 5. Realtime Implementation Design

### 5.1 Sample-by-Sample vs. Block-Based

**Sample-by-sample processing** is the natural fit for envelope-based transient shaping. All the envelope followers, gain computation, and gain application are inherently sample-by-sample operations with O(1) state per channel. This makes the core algorithm compatible with any block size, including block size = 1 (which some hosts use for parameter automation accuracy).

**Block-based processing** is needed only for methods that require windowed computation (energy flux, spectral flux, STFT). Even then, the block processing should be encapsulated within the detector stage, with the gain application remaining sample-by-sample.

**Recommendation:** Implement the core algorithm as sample-by-sample. If using energy flux or spectral flux detection, buffer samples internally and produce one detection output per block, then interpolate the gain signal to sample rate.

### 5.2 Buffer Considerations

The algorithm requires minimal internal buffering:

- **Lookahead buffer:** If using lookahead, a delay line of N samples (typically 64–256 samples for 1–6 ms at 44.1 kHz). Implemented as a circular buffer.
- **Envelope state:** 2–4 float values per channel (fast envelope, slow envelope, smoothed gain, previous input).
- **Multiband:** Per-band filter state (2–4 biquad states per band per channel) plus per-band envelope state.

Total memory footprint is trivially small — tens to hundreds of bytes per channel.

### 5.3 Denormal Protection

Envelope followers with high α values (long time constants) produce very small float values as the envelope decays toward zero. On x86 CPUs, denormalized floats (values smaller than ~1.2e-38) cause massive performance penalties — up to 100× slower processing.

**Protection strategies:**

1. **DC bias injection:** Add a tiny constant (1e-15 to 1e-12) to the envelope computation. This keeps the value above the denormal threshold.

```
env[n] = α * env[n-1] + (1 - α) * x_rect[n] + 1e-15
```

2. **Flush-to-zero (FTZ):** Set the CPU's FTZ flag at the start of the audio processing callback. This causes all denormals to be flushed to zero with no performance penalty. On x86/SSE:

```cpp
_mm_setcsr(_mm_getcsr() | 0x8040);  // FTZ + DAZ
```

3. **Periodic reset:** If the envelope value drops below a threshold (e.g., 1e-20), snap it to zero.

**Recommendation:** Use FTZ/DAZ flags as the primary strategy. Add DC bias as a belt-and-suspenders measure for the envelope followers specifically.

### 5.4 Latency Budgeting

| Mode | Latency | Quality | Use Case |
|---|---|---|---|
| Zero-latency | 0 samples | Good | Live monitoring, real-time performance |
| Low-latency | 32–128 samples (0.7–2.9 ms @ 44.1k) | Very good | Live sound, tracking |
| Studio | 128–512 samples (2.9–11.6 ms @ 44.1k) | Excellent | Mixing, mastering |

**Zero-latency mode** has no lookahead, so the detector sees the transient at the same time as the gain is applied. This means the very first sample of a transient gets no boost — the gain ramps up *during* the transient rather than *before* it. For most material this is acceptable; the ear integrates over several milliseconds.

**Low-latency mode** with 1–3 ms lookahead allows the detector to "see" the transient slightly before it arrives at the gain stage. This enables the gain to be fully ramped up by the time the transient arrives, producing cleaner and more precise shaping. This is the sweet spot for most applications.

**Studio mode** with longer lookahead enables more sophisticated detection (energy flux, spectral flux) and smoother gain transitions. The increased latency is compensated by the DAW's plugin delay compensation.

### 5.5 State Handling

All state must be initialized to zero (or a safe default) and must be resettable. Key state variables:

```
struct TransientShaperState {
    float env_fast;        // Fast envelope follower state
    float env_slow;        // Slow envelope follower state
    float gain_smooth;     // Smoothed gain value
    float prev_input;      // For derivative computation (if used)
    float lookahead_buffer[MAX_LOOKAHEAD];  // Circular buffer
    int   lookahead_write_pos;
};
```

**State reset** should be performed on:
- Plugin initialization
- Transport start/stop (if the host notifies)
- Sample rate change
- Buffer size change

### 5.6 CPU/Performance Hotspots

In order of typical cost:

1. **Multiband crossover filters** — If using IIR biquads, each band boundary requires 2 biquad evaluations per sample per channel. With 3 bands (2 crossovers), this is 4 biquad evaluations. At ~10 multiply-adds per biquad, this is ~40 multiply-adds per sample per channel. Dominant cost for multiband designs.

2. **Envelope followers** — ~4–6 multiply-adds per follower per sample. With 2 followers per band across 3 bands, this is ~24–36 multiply-adds.

3. **Gain computation** — ~5–10 operations per sample (clamping, scaling, smoothing).

4. **Lookahead delay line** — Negligible cost (one read + one write per sample).

**Total for a 3-band design:** ~80–100 multiply-adds per sample per channel. At 44.1 kHz stereo, this is ~7–9 million multiply-adds per second — well within the budget of any modern CPU.

### 5.7 Parameter Interpolation

User-controlled parameters (attack amount, sustain amount, sensitivity, crossover frequencies) must not be applied instantaneously, as step changes cause clicks.

**For gain-related parameters (attack amount, sustain amount):** Use exponential smoothing with a time constant of 10–50 ms:

```
param_smooth[n] = 0.999 * param_smooth[n-1] + 0.001 * param_target
```

**For crossover frequencies:** Recompute biquad coefficients from the smoothed frequency value. Coefficient updates can be done once per block (every 32–256 samples) rather than per-sample, since crossover frequency changes are slow.

**For time-constant parameters (speed, sensitivity):** Recompute the α coefficients from the smoothed time-constant values. Again, per-block updates are sufficient.

### 5.8 Branch Minimization / Vectorization

The asymmetric envelope follower contains a branch (attack vs. release path). This can be eliminated with branchless selection:

```
float diff = x_rect - env_prev;
float alpha = alpha_release + (alpha_attack - alpha_release) * (diff > 0);
env = alpha * env_prev + (1 - alpha) * x_rect;
```

On modern CPUs with SIMD, this is slightly faster than a branch. However, the performance gain is marginal for this algorithm — the branch is highly predictable and the computation is not the bottleneck.

**SIMD opportunities:** Stereo processing can be vectorized by processing L and R channels simultaneously in a 2-wide SIMD register. Multiband processing can be vectorized by processing all bands simultaneously if the band count matches the SIMD width (4 bands = SSE float4).

### 5.9 Safe Plugin Architecture Considerations

**Thread safety:** The audio thread reads parameters; the UI thread writes them. Use atomic loads/stores for parameter values. Never allocate memory, lock mutexes, or perform I/O on the audio thread.

**Tail time:** After input goes silent, the envelope followers decay toward zero. Report a tail time equal to the longest release time constant × 5 (five time constants for 99.3% decay).

**Bypass:** True bypass should produce bit-identical output. When bypassed, still advance the delay line to maintain correct state for seamless bypass toggling.

**Sample rate handling:** All time constants must be recalculated when the sample rate changes. Store time constants in milliseconds internally and convert to coefficients at sample rate change.

---

## 6. Multiband Design Deep Dive

### 6.1 Why Multiband Is More Useful Than Broadband

Audio transients have different characteristics in different frequency ranges:

- **Low frequencies (< 200 Hz):** Kick drum transients are relatively slow (5–20 ms rise time). Bass guitar transients are even slower. The "click" of a kick beater is actually in the mid/high range — the low-frequency component swells more gradually.
- **Mid frequencies (200 Hz – 4 kHz):** Snare attack, guitar pick, vocal consonants. These are the "core" transients that most users want to control.
- **High frequencies (> 4 kHz):** Hi-hat, cymbal splash, sibilance, string noise. These transients are very fast (< 1 ms) and often undesirable to boost.

A broadband transient shaper treats all of these identically. Boosting attack on a full drum bus boosts kick click, snare snap, *and* hi-hat sizzle equally. This is often not what the user wants. A multiband design allows boosting snare attack while leaving (or even reducing) hi-hat attack.

### 6.2 Crossover Design Options

#### 6.2.1 Linkwitz-Riley IIR Crossovers (Recommended for V1)

Linkwitz-Riley (LR) crossovers are the industry standard for audio crossovers because they have a critical property: **the low-pass and high-pass outputs sum to unity** (flat magnitude response) at all frequencies, with no phase cancellation at the crossover point.

An LR4 (4th-order Linkwitz-Riley) crossover consists of two cascaded 2nd-order Butterworth filters:

```
LR4_LP(f) = Butterworth_LP_2(f) * Butterworth_LP_2(f)
LR4_HP(f) = Butterworth_HP_2(f) * Butterworth_HP_2(f)
```

At the crossover frequency, each output is at -6 dB. Their sum is 0 dB (unity).

**Advantages:** Zero latency. Perfect magnitude reconstruction. Low CPU cost. Well-understood.

**Disadvantages:** Non-linear phase — the phase response is not flat. However, LR4 phase distortion is inaudible in practice for crossover frequencies in the typical audio range. The phase shift is smooth and well-behaved.

**For 3 bands:** Use two LR4 crossovers. The signal path:

```
input → LR4_LP(f1) → Band 1 (low)
input → LR4_HP(f1) → LR4_LP(f2) → Band 2 (mid)
input → LR4_HP(f1) → LR4_HP(f2) → Band 3 (high)
```

**Important:** The mid band must be computed by high-passing the low crossover output *and then* low-passing through the high crossover. Simply subtracting Band 1 and Band 3 from the input does not produce correct results with IIR filters due to phase misalignment.

**Correct 3-band LR4 topology:**

```
input ──┬── LR4_LP(f1) ───────────────── Band 1 (Low)
        │
        └── LR4_HP(f1) ──┬── LR4_LP(f2) ── Band 2 (Mid)
                          │
                          └── LR4_HP(f2) ── Band 3 (High)
```

This topology ensures that Band 2 + Band 3 = HP(f1) output, and Band 1 + Band 2 + Band 3 = input (with LR phase alignment).

#### 6.2.2 Butterworth IIR Crossovers

Similar to LR but using odd-order Butterworth filters. The crossover point is at -3 dB per band rather than -6 dB, which means the sum at the crossover point is +3 dB (a bump). This is usually corrected by applying a complementary allpass filter.

**Not recommended** for transient shaping because the phase correction adds complexity and the magnitude bump at crossover frequencies can interact poorly with transient gain modulation.

#### 6.2.3 FIR / Linear-Phase Crossovers

Use linear-phase FIR filters for the crossover. All bands have identical group delay (half the filter length), resulting in **perfect phase coherence** between bands.

**Advantages:** No phase distortion whatsoever. Perfect reconstruction if designed correctly. Bands can be processed completely independently with no phase-alignment concerns.

**Disadvantages:** Significant latency — a 512-tap FIR at 44.1 kHz adds ~5.8 ms of latency. Higher CPU cost (FIR convolution). Pre-ringing artifacts from the linear-phase filter can smear transients in the time domain — paradoxically counterproductive for a transient shaper.

**Recommendation:** Avoid FIR crossovers for transient shaping. The pre-ringing of linear-phase filters can smear the very transients the algorithm is trying to shape. LR4 IIR crossovers are superior for this application.

#### 6.2.4 STFT / Spectral Domain

The signal is decomposed via STFT into frequency bins. "Bands" are groups of bins. Transient detection and gain modulation are applied per-bin or per-band-of-bins, and the signal is resynthesized via inverse STFT with overlap-add.

**Advantages:** Maximum frequency resolution. Can implement arbitrary frequency-dependent transient shaping.

**Disadvantages:** High latency (at least one STFT window, typically 10–50 ms). High CPU cost. Overlap-add artifacts are possible. Phase handling between frames is complex. Overkill for most transient shaping applications.

**Recommendation:** Reserve for premium/experimental versions. Not suitable for V1.

#### 6.2.5 Wavelet Decomposition

Discrete wavelet transform (DWT) provides multi-resolution time-frequency analysis. Lower frequencies get longer analysis windows; higher frequencies get shorter windows. This matches the natural characteristics of audio transients.

**Advantages:** Theoretically ideal time-frequency resolution for transient detection. Shorter latency than STFT for low frequencies.

**Disadvantages:** Less intuitive to control (wavelet basis selection, decomposition depth). Reconstruction can introduce artifacts. Not widely used in commercial audio plugins, so less established engineering practice.

**Recommendation:** Interesting for research/advanced versions. Not recommended for V1.

### 6.2.6 Crossover Comparison Table

| Method | Latency | Phase | CPU | Reconstruction | Suitability |
|---|---|---|---|---|---|
| LR4 IIR | 0 | Minimum phase | Low | Perfect (magnitude) | **Recommended** |
| Butterworth IIR | 0 | Minimum phase | Low | Needs correction | Acceptable |
| FIR linear-phase | 3–12 ms | Linear | Medium | Perfect | Not recommended (pre-ringing) |
| STFT | 10–50 ms | Complex | High | Good (overlap-add) | Advanced only |
| Wavelet | Variable | Complex | Medium–High | Good | Research only |

### 6.3 Recommended Band Counts

**V1: 3 bands.** Low / Mid / High with two crossover frequency controls. This covers the most important use case (independent control of bass punch, snare/guitar attack, and cymbal/sibilance treatment) with minimal complexity.

**Advanced: 4–5 bands.** Low / Low-Mid / Mid / High-Mid / High. Diminishing returns above 5 bands for transient shaping; the ear does not perceive band-specific transient differences with that much granularity.

**Maximum useful: 6 bands.** Beyond this, the controls become unwieldy and the sonic differences between adjacent bands are negligible.

### 6.4 Per-Band vs. Full-Band Transient Detection

**Per-band detection:** Each band has its own envelope followers and transient detector. This is the default and most flexible approach. However, it can produce incoherent results — a kick drum transient detected in the low band at a slightly different time than in the mid band (where the beater click lives), leading to temporal smearing across bands.

**Full-band detection:** A single transient detector operates on the full-band signal (or a mix of the band signals). The detection output is shared across all bands, which apply their own gain amounts but with synchronized timing. This preserves temporal coherence but prevents truly independent per-band transient treatment.

**Hybrid detection (recommended):** Use full-band detection for timing (when does a transient occur?) and per-band detection for magnitude (how strong is the transient in this band?). This preserves timing coherence while allowing frequency-dependent gain amounts.

Implementation:

```
transient_timing = detect_transient(full_band_input)
for each band:
    transient_strength[band] = detect_transient_strength(band_signal)
    gain[band] = compute_gain(transient_timing, transient_strength[band], user_params[band])
```

### 6.5 Phase/Coherence Concerns

With LR4 IIR crossovers, the bands are phase-aligned by design (when using the correct topology described in §6.2.1). Applying *different* gains to different bands during transient events does not cause phase cancellation — it changes the spectral balance during the transient, which is the intended effect.

However, if the gain modulation in adjacent bands changes rapidly and in opposite directions (e.g., boosting low attack while cutting mid attack), the transition at the crossover frequency can produce a momentary spectral notch or bump. This is generally inaudible for moderate gain amounts (±6 dB) but can become noticeable for extreme settings.

**Mitigation:** Apply cross-band gain smoothing — blend the gain values of adjacent bands near the crossover frequency. This prevents sharp spectral discontinuities.

### 6.6 Recombination Strategy

For LR4 IIR crossovers with the correct topology, recombination is simple summation:

```
output = band_1_processed + band_2_processed + band_3_processed
```

No normalization or windowing is required because the LR4 crossover guarantees unity-sum magnitude response.

**Verification:** Process a unit impulse through the crossover and recombination. The output should be a delayed impulse (delayed by the filter group delay). Process white noise and verify flat magnitude spectrum.

### 6.7 Cross-Band Masking / Interaction

In dense material (e.g., full mix), transients in one band can mask or be masked by content in other bands. A kick drum transient in the low band coincides with bass guitar sustain; a snare transient in the mid band coincides with guitar strumming.

**Should transients in one band influence others?** Generally no for V1. Each band should operate independently. However, an advanced feature could implement:

- **Sidechain linking:** The low-band transient detector output slightly influences the mid-band gain, preventing the mid band from being boosted when a kick transient is detected (to avoid boosting kick bleed into the mid range).
- **Duck-on-transient:** When a strong transient is detected in any band, slightly duck the sustain in other bands. This creates a "tightening" effect similar to multi-band sidechain compression.

These are advanced features that add significant complexity and should be deferred.

---

## 7. Artifact Prevention & Robustness

### 7.1 Gain Smoothing Methods

**Exponential smoothing (recommended):** The simplest and most CPU-efficient method. Use asymmetric attack/release as described in §4.5. The attack smoothing time should be shorter than the release to preserve transient responsiveness.

**Ballistic smoothing:** Model the gain as a physical system with mass and damping. This produces more natural-sounding gain changes but adds complexity.

**Cosine interpolation:** When the gain changes from one value to another, use a cosine-shaped transition over a fixed number of samples. This avoids the exponential "tail" problem but requires knowing the target gain in advance (not always possible for real-time operation).

### 7.2 Anti-Click Strategies

Clicks are caused by discontinuous gain changes. The primary defense is gain smoothing (§7.1). Additional measures:

- **Minimum transition time:** Never allow the gain to change by more than X dB per sample. For example, at 44.1 kHz, limiting to 0.1 dB/sample allows a 10 dB gain change over ~2.3 ms — fast enough for transient shaping but slow enough to prevent audible clicks.
- **Zero-crossing detection:** Only allow gain changes near signal zero-crossings. This eliminates clicks completely but adds latency (up to half a waveform period at the lowest frequency present). Generally not practical for broadband use.
- **Gain-change windowing:** Apply a short Hann or raised-cosine window to any gain step larger than a threshold.

### 7.3 Handling Bass Transients Without Distortion

Bass transients are problematic because the wavelengths are long relative to the transient detection window. A 60 Hz kick has a period of 16.7 ms — the detector may classify the rising half-cycle as a "transient" and apply boost, then classify the falling half-cycle differently. This produces asymmetric gain modulation that creates even-harmonic distortion.

**Solutions:**

- **Use squared-envelope detection** so that both positive and negative half-cycles contribute equally.
- **Set the fast envelope attack time longer for the low band** (2–5 ms instead of 0.5–1 ms) so that it tracks the amplitude envelope rather than individual cycles.
- **Apply a highpass filter to the detector sidechain** (not the audio path) to remove sub-100 Hz content from the detection signal. This prevents the detector from "seeing" individual bass waveform cycles while still detecting the envelope of bass transients.
- **Use a longer gain smoothing time for the low band** to prevent cycle-by-cycle gain modulation.

### 7.4 Preventing Hi-Hat Fizz Exaggeration

Hi-hats and cymbals have fast, dense transients that can be exaggerated by attack boost, creating an unpleasant sizzly or fizzy character. In a multiband design, this is handled by providing independent control over the high band — users can reduce or zero the attack boost above 4–8 kHz.

In a broadband design, mitigations include:

- **Sensitivity weighting:** Reduce the transient detector's sensitivity to high-frequency content by highpass-filtering the sidechain below 3–5 kHz or applying a weighted sum.
- **Transient duration gating:** Hi-hat transients are very short (< 1 ms). If the transient signal is sustained for less than a minimum duration (e.g., 2 ms), reduce the gain boost. This lets through snare and kick transients (which are longer) while suppressing hi-hat spikes.
- **Level-dependent limiting:** Apply a maximum gain boost that decreases as the high-frequency energy increases.

### 7.5 Transient Over-Detection on Noisy Material

Live recordings, analog-sourced material, and heavily compressed signals have noise or level variation that can trigger false transient detections. The detector "sees" noise floor modulation or low-level artifacts as transients.

**Solutions:**

- **Noise gate on the detector:** If the signal level is below a threshold (e.g., -60 dBFS), suppress the transient signal. This prevents the detector from responding to noise-floor content.
- **Hysteresis:** Require the transient signal to exceed a threshold for a minimum number of consecutive samples before triggering gain modulation. A single-sample spike is ignored.
- **Adaptive threshold:** Track the noise floor using a very slow envelope and set the transient detection threshold relative to the noise floor. This allows the detector to work correctly on both clean and noisy material.

### 7.6 Stereo Consistency

**Problem:** If left and right channels are processed independently, a transient that appears in one channel but not the other (e.g., a panned hi-hat) will receive different gain in each channel. This shifts the stereo image during transient events.

**Solutions:**

- **Stereo linking:** Use the maximum (or average) of the L and R transient signals to drive both channels' gain. This preserves the stereo image at the cost of making the effect less independent per-channel.

```
transient_linked = max(transient_L, transient_R)  // or mean
gain_L = compute_gain(transient_linked, params)
gain_R = gain_L
```

- **Variable linking:** Provide a user control (0–100%) for stereo linking. At 0%, channels are fully independent. At 100%, fully linked. Intermediate values blend the independent and linked transient signals.

```
transient_L_final = (1 - link) * transient_L + link * transient_linked
transient_R_final = (1 - link) * transient_R + link * transient_linked
```

### 7.7 Mono Compatibility

Applying different gain to L and R channels creates a signal that sums to mono differently than the original. Specifically, if the gain during a transient is higher in one channel than the other, the mono sum during the transient will be different from what simple L+R summation would produce.

This is generally not a problem for moderate gain amounts (±6 dB) and is inherent to any stereo dynamics processor. However, for critical applications, the stereo linking control (§7.6) ensures mono compatibility by applying identical gain to both channels.

### 7.8 Level-Dependent / Adaptive Protection

For robust behavior across diverse material, implement:

- **Output level monitoring:** If the output level exceeds -1 dBFS for more than N consecutive samples, automatically reduce the attack gain to prevent clipping.
- **Adaptive sensitivity:** Track the average transient density (number of transient events per second). If the density is very high (e.g., fast hi-hat pattern), reduce the transient gain to prevent the effect from being applied essentially continuously (which defeats the purpose).
- **Gain range limiting:** Clamp the maximum boost to a user-controllable range (e.g., ±12 dB). Extreme boost values (>12 dB) rarely sound good and often produce artifacts.

---

## 8. Architecture Recommendations

### Architecture A: Minimal V1

**Goal:** Simple, working, decent-sounding broadband transient shaper.

**Signal path:**

```
Input → Sidechain HPF (80Hz) → Abs Rectification → Fast Env → ┐
                                                                 ├→ Diff → Gain Compute → Gain Smooth → × Input → Output
Input → Sidechain HPF (80Hz) → Abs Rectification → Slow Env → ┘
```

**Detector path:** Dual asymmetric envelope followers on the highpass-filtered rectified input. Fast: attack 0.5 ms, release 10 ms. Slow: attack 20 ms, release 100 ms.

**Key parameters:**
- Attack amount: -12 to +12 dB
- Sustain amount: -12 to +12 dB
- Mix: 0–100%

**Estimated complexity:** ~20 multiply-adds per sample per channel. Negligible CPU.

**Pros:** Trivial to implement. Very fast. Zero latency. Easy to debug.

**Cons:** No frequency-dependent control. Bass waveform tracking possible at extreme settings. No lookahead means imperfect transient capture. Can exaggerate hi-hat fizz.

**Best use cases:** Quick prototyping, learning, simple drum bus treatment, inline insert effects.

### Architecture B: Production Realtime Version

**Goal:** Robust, artifact-free, multiband transient shaper suitable for a shipping plugin.

**Signal path:**

```
Input → LR4 Crossover (3 bands) → Per-band processing → Summation → Soft Limiter → Output
                                         │
Per-band processing:                     │
  Band Signal → Rectification → Fast Env ─┐
                                           ├→ Normalized Diff → Gain Compute → Gain Smooth → × Band Signal (delayed)
  Band Signal → Rectification → Slow Env ─┘

Sidechain modification per band:
  Low band: Sidechain HPF at 60 Hz, longer time constants
  Mid band: Standard time constants
  High band: Sidechain LPF at 12 kHz, slightly longer release
```

**Detector path:** Per-band dual-envelope with band-appropriate time constants. Full-band transient timing reference (hybrid detection).

**Key parameters:**
- Per-band attack amount: -12 to +12 dB
- Per-band sustain amount: -12 to +12 dB
- Crossover frequencies: 2 controls (default 200 Hz, 4 kHz)
- Sensitivity: global, maps to fast envelope time constant
- Speed: global, maps to slow envelope time constant
- Stereo link: 0–100%
- Lookahead: 0–3 ms (user-selectable or auto)
- Mix: 0–100%
- Output trim: ±6 dB

**Estimated complexity:** ~100 multiply-adds per sample per channel. < 1% CPU on any modern machine.

**Pros:** Frequency-dependent transient control. Clean bass handling. Controlled hi-hat behavior. Stereo-safe. Low latency. Artifact-resistant.

**Cons:** More parameters to tune. Crossover adds slight phase shift (inaudible with LR4). More complex to implement and test.

**Best use cases:** DAW plugin, live sound processor, audio app feature, drum processing, mix bus treatment.

### Architecture C: Advanced / Premium Version

**Goal:** High-end transient shaper with intelligent detection, advanced controls, and studio-quality sound.

**Signal path:**

```
Input → Oversampled Processing (2× optional) →
  LR4 Crossover (4–5 bands) → Per-band processing → Cross-band smoothing → Summation →
  Soft Limiter → Downsample → Output

Per-band processing:
  Band Signal → Energy Flux Detection (2ms windows) → Transient/Sustain Classification →
  Adaptive Gain Compute (program-dependent) → Anti-click Gain Smooth → × Band Signal (delayed)

Additional features:
  - Mid/Side processing option
  - Adaptive time constants based on source density
  - Per-band sidechain listen
  - Transient detection visualization
  - A/B/C/D state comparison
```

**Detector path:** Energy-flux-based detection with 2 ms windows, adaptive sensitivity, and noise-floor gating. Full-band timing reference with per-band magnitude. Optional spectral flux mode for maximum precision (higher latency).

**Key parameters (all of Architecture B, plus):**
- Band count: 3, 4, or 5 (user-selectable)
- Detection mode: envelope / energy-flux / spectral-flux
- Adaptive sensitivity: on/off/amount
- Character: soft / neutral / hard
- Per-band sidechain filter (HPF, LPF, or bandpass on detector input)
- Mid/Side amount: L/R → M/S → separate transient shaping → M/S → L/R
- Oversampling: off / 2× / 4×
- Per-band solo/mute/bypass
- Range (maximum gain change): per-band, ±24 dB

**Estimated complexity:** ~200–500 multiply-adds per sample per channel (without oversampling). With 2× oversampling, double that. ~2–5% CPU.

**Pros:** Maximum quality and control. Handles diverse material well. Adaptive behavior reduces need for manual tweaking. Mid/side processing enables spatial transient control.

**Cons:** Complex to implement and test. Many parameters can overwhelm users. Higher CPU cost. Energy-flux detection adds 2+ ms latency.

**Best use cases:** Premium plugin, mastering tool, post-production, sound design.

---

## 9. Pseudocode / Implementation Blueprint

### 9.1 Broadband Transient Shaper (Architecture A)

```python
class BroadbandTransientShaper:

    def __init__(self, sample_rate):
        self.fs = sample_rate

        # Envelope follower coefficients
        self.fast_attack_coeff  = exp(-1.0 / (0.0005 * self.fs))   # 0.5 ms
        self.fast_release_coeff = exp(-1.0 / (0.010 * self.fs))    # 10 ms
        self.slow_attack_coeff  = exp(-1.0 / (0.020 * self.fs))    # 20 ms
        self.slow_release_coeff = exp(-1.0 / (0.100 * self.fs))    # 100 ms
        self.gain_smooth_coeff  = exp(-1.0 / (0.001 * self.fs))    # 1 ms

        # Sidechain HPF (80 Hz, 1st-order)
        self.hpf_coeff = exp(-2.0 * pi * 80.0 / self.fs)

        # State (per channel)
        self.env_fast = 0.0
        self.env_slow = 0.0
        self.gain_smooth = 1.0
        self.hpf_state = 0.0

    def process_sample(self, x, attack_amount_db, sustain_amount_db, mix):
        # Sidechain HPF to remove bass waveform from detection
        hpf_out = x - self.hpf_state
        self.hpf_state = self.hpf_coeff * self.hpf_state + (1 - self.hpf_coeff) * x

        # Rectify
        x_rect = abs(hpf_out)

        # Fast envelope
        if x_rect > self.env_fast:
            self.env_fast = self.fast_attack_coeff * self.env_fast + (1 - self.fast_attack_coeff) * x_rect
        else:
            self.env_fast = self.fast_release_coeff * self.env_fast + (1 - self.fast_release_coeff) * x_rect

        # Slow envelope
        if x_rect > self.env_slow:
            self.env_slow = self.slow_attack_coeff * self.env_slow + (1 - self.slow_attack_coeff) * x_rect
        else:
            self.env_slow = self.slow_release_coeff * self.env_slow + (1 - self.slow_release_coeff) * x_rect

        # Denormal protection
        self.env_fast += 1e-15
        self.env_slow += 1e-15

        # Normalized transient signal
        transient = (self.env_fast - self.env_slow) / max(self.env_slow, 1e-8)

        # Separate attack and sustain components
        attack_signal  = max(transient, 0.0)    # Positive = rising = attack
        sustain_signal = max(-transient, 0.0)    # Negative = falling = sustain

        # Compute gain in dB
        gain_db = attack_amount_db * min(attack_signal, 1.0) \
                + sustain_amount_db * min(sustain_signal, 1.0)

        # Convert to linear gain
        gain_linear = 10.0 ** (gain_db / 20.0)

        # Smooth gain to prevent clicks
        self.gain_smooth = self.gain_smooth_coeff * self.gain_smooth \
                         + (1 - self.gain_smooth_coeff) * gain_linear

        # Apply with wet/dry mix
        output = (mix * self.gain_smooth + (1.0 - mix)) * x

        return output
```

### 9.2 Multiband Transient Shaper (Architecture B)

```python
class MultibandTransientShaper:

    def __init__(self, sample_rate, crossover_low=200, crossover_high=4000):
        self.fs = sample_rate

        # Crossover filters (LR4 = 2 × Butterworth 2nd order)
        self.xover_low  = LR4Crossover(crossover_low, sample_rate)
        self.xover_high = LR4Crossover(crossover_high, sample_rate)

        # Per-band transient shapers with band-appropriate time constants
        self.band_low = BandTransientShaper(sample_rate,
            fast_attack_ms=2.0, fast_release_ms=20.0,
            slow_attack_ms=40.0, slow_release_ms=200.0,
            sidechain_hpf=40.0)

        self.band_mid = BandTransientShaper(sample_rate,
            fast_attack_ms=0.5, fast_release_ms=10.0,
            slow_attack_ms=20.0, slow_release_ms=100.0,
            sidechain_hpf=0.0)   # No HPF needed for mid band

        self.band_high = BandTransientShaper(sample_rate,
            fast_attack_ms=0.2, fast_release_ms=5.0,
            slow_attack_ms=10.0, slow_release_ms=50.0,
            sidechain_hpf=0.0)

        # Lookahead delay line
        self.lookahead_samples = int(0.002 * sample_rate)  # 2 ms
        self.delay_line = CircularBuffer(self.lookahead_samples)

        # Soft limiter
        self.limiter_ceiling = 0.98  # ~-0.18 dBFS
        self.limiter_knee = 0.1

    def process_sample(self, x, params):
        # Split into bands using LR4 crossover
        low, high_rest = self.xover_low.process(x)
        mid, high = self.xover_high.process(high_rest)

        # Process each band
        low_out  = self.band_low.process(low,
            params.attack_low, params.sustain_low, params.stereo_link_factor)
        mid_out  = self.band_mid.process(mid,
            params.attack_mid, params.sustain_mid, params.stereo_link_factor)
        high_out = self.band_high.process(high,
            params.attack_high, params.sustain_high, params.stereo_link_factor)

        # Recombine
        y = low_out + mid_out + high_out

        # Soft limit
        if abs(y) > self.limiter_ceiling - self.limiter_knee:
            y = sign(y) * soft_clip(abs(y), self.limiter_ceiling, self.limiter_knee)

        # Wet/dry mix using the delayed (aligned) dry signal
        x_delayed = self.delay_line.read_and_write(x)
        output = params.mix * y + (1.0 - params.mix) * x_delayed

        return output


class LR4Crossover:
    """Linkwitz-Riley 4th-order crossover (2 cascaded Butterworth 2nd-order)"""

    def __init__(self, freq, sample_rate):
        self.lp1 = BiquadLPF(freq, sample_rate, Q=0.7071)
        self.lp2 = BiquadLPF(freq, sample_rate, Q=0.7071)
        self.hp1 = BiquadHPF(freq, sample_rate, Q=0.7071)
        self.hp2 = BiquadHPF(freq, sample_rate, Q=0.7071)

    def process(self, x):
        lp = self.lp2.process(self.lp1.process(x))
        hp = self.hp2.process(self.hp1.process(x))
        return lp, hp


class BandTransientShaper:
    """Transient shaper for a single frequency band"""

    def __init__(self, sample_rate, fast_attack_ms, fast_release_ms,
                 slow_attack_ms, slow_release_ms, sidechain_hpf):
        self.fs = sample_rate

        self.fast_att = exp(-1.0 / (fast_attack_ms * 0.001 * sample_rate))
        self.fast_rel = exp(-1.0 / (fast_release_ms * 0.001 * sample_rate))
        self.slow_att = exp(-1.0 / (slow_attack_ms * 0.001 * sample_rate))
        self.slow_rel = exp(-1.0 / (slow_release_ms * 0.001 * sample_rate))
        self.gain_smooth_coeff = exp(-1.0 / (0.001 * sample_rate))

        self.env_fast = 0.0
        self.env_slow = 0.0
        self.gain_smooth = 1.0

        if sidechain_hpf > 0:
            self.hpf = OnePoleHPF(sidechain_hpf, sample_rate)
        else:
            self.hpf = None

    def process(self, x, attack_db, sustain_db, stereo_link_factor):
        # Sidechain
        sc = self.hpf.process(x) if self.hpf else x
        x_rect = abs(sc)

        # Envelope followers
        if x_rect > self.env_fast:
            self.env_fast = self.fast_att * self.env_fast + (1 - self.fast_att) * x_rect
        else:
            self.env_fast = self.fast_rel * self.env_fast + (1 - self.fast_rel) * x_rect

        if x_rect > self.env_slow:
            self.env_slow = self.slow_att * self.env_slow + (1 - self.slow_att) * x_rect
        else:
            self.env_slow = self.slow_rel * self.env_slow + (1 - self.slow_rel) * x_rect

        self.env_fast += 1e-15
        self.env_slow += 1e-15

        # Transient estimation
        transient = (self.env_fast - self.env_slow) / max(self.env_slow, 1e-8)

        attack_sig  = clamp(transient, 0.0, 1.0)
        sustain_sig = clamp(-transient, 0.0, 1.0)

        gain_db = attack_db * attack_sig + sustain_db * sustain_sig
        gain_lin = 10.0 ** (gain_db / 20.0)

        # Asymmetric gain smoothing
        if gain_lin > self.gain_smooth:
            coeff = exp(-1.0 / (0.0003 * self.fs))   # 0.3 ms attack
        else:
            coeff = exp(-1.0 / (0.002 * self.fs))     # 2 ms release

        self.gain_smooth = coeff * self.gain_smooth + (1 - coeff) * gain_lin

        return self.gain_smooth * x
```

### 9.3 Parameter Smoothing

```python
class ParameterSmoother:
    """Exponential parameter smoother with per-block coefficient update"""

    def __init__(self, sample_rate, smoothing_ms=20.0):
        self.coeff = exp(-1.0 / (smoothing_ms * 0.001 * sample_rate))
        self.current = 0.0
        self.target = 0.0

    def set_target(self, value):
        self.target = value

    def next(self):
        self.current = self.coeff * self.current + (1 - self.coeff) * self.target
        return self.current

    def is_settled(self, tolerance=1e-6):
        return abs(self.current - self.target) < tolerance
```

### 9.4 Detector Stage (Energy Flux Variant)

```python
class EnergyFluxDetector:
    """Energy-flux-based transient detector for premium detection quality"""

    def __init__(self, sample_rate, window_ms=2.0, hop_ms=1.0):
        self.window_size = int(window_ms * 0.001 * sample_rate)
        self.hop_size = int(hop_ms * 0.001 * sample_rate)
        self.buffer = RingBuffer(self.window_size)
        self.prev_energy = 0.0
        self.sample_counter = 0
        self.current_flux = 0.0
        self.flux_smooth_coeff = exp(-1.0 / (0.005 * sample_rate))
        self.flux_smooth = 0.0

    def process_sample(self, x):
        self.buffer.write(x)
        self.sample_counter += 1

        if self.sample_counter >= self.hop_size:
            self.sample_counter = 0

            # Compute energy of current window
            window = self.buffer.read_all()
            energy = sum(s * s for s in window) / self.window_size

            # Energy flux = positive change in energy
            flux = max(energy - self.prev_energy, 0.0)
            self.prev_energy = energy

            # Normalize by previous energy to make level-independent
            if self.prev_energy > 1e-10:
                self.current_flux = flux / self.prev_energy
            else:
                self.current_flux = 0.0

        # Smooth the flux signal to sample rate
        self.flux_smooth = self.flux_smooth_coeff * self.flux_smooth \
                         + (1 - self.flux_smooth_coeff) * self.current_flux

        return self.flux_smooth
```

---

## 10. Evaluation Plan

### 10.1 Objective Metrics

Transient shaping is largely a subjective effect, but some objective measurements are useful:

**Envelope fidelity test:** Process a known input (e.g., a sequence of impulses at -12 dBFS with 100 ms spacing) and verify that the output envelope matches the expected shaped envelope within ±1 dB.

**Unity-gain verification:** With attack and sustain amounts set to 0 dB, the output must be bit-identical to the input (or, for multiband, within ±0.01 dB of the input after crossover reconstruction).

**Crest factor measurement:** Process drum loops with known crest factors. Attack boost should increase crest factor; attack cut should decrease it. Measure the crest factor change and verify it correlates with the user-set amount.

**Spectral balance verification (multiband):** Process broadband pink noise with all transient amounts at 0 dB. Measure the output spectrum. It should be flat within ±0.5 dB across the full frequency range. This verifies crossover reconstruction accuracy.

**Latency measurement:** Measure the actual latency by processing an impulse and measuring the delay of the output impulse. Should match the declared latency.

### 10.2 Subjective Listening Tests

Conduct A/B listening tests with experienced audio engineers. Key questions:

- Does attack boost make drums sound "punchier"?
- Does attack cut make drums sound "softer" without losing tone?
- Does sustain boost add "body" without muddiness?
- Does sustain cut "tighten" without making the sound thin?
- Are there any audible clicks, pops, or zipper noise?
- Does the stereo image remain stable?
- Does the effect sound "musical" or "surgical/digital"?

### 10.3 Recommended Test Material

**Primary test signals:**
- Acoustic drum kit (multitrack: kick, snare, overheads, room)
- Electronic drum loop (808-style with clean transients)
- Fingerpicked acoustic guitar
- Slapped electric bass
- Full mix (pop/rock)
- Full mix (electronic/EDM)
- Vocal with sibilance

**Failure-case test material:**
- Heavily compressed brickwall-limited master (tests false detection)
- Sine wave with slow amplitude ramp (should NOT trigger transient detection)
- White noise (should produce minimal gain modulation)
- Sub-bass sine wave at 40 Hz (tests bass distortion)
- Dense hi-hat pattern at high velocity (tests fizz exaggeration)
- Spoken word with plosives (tests consonant handling)
- Orchestral crescendo (tests false triggering on gradual swells)
- Silence / very low level signal (tests noise floor behavior)

### 10.4 Per-Source Evaluation Criteria

| Source | Key Success Criteria |
|---|---|
| Kick drum | Attack boost adds click/beater; no distortion on fundamental |
| Snare | Attack boost adds snap; sustain boost adds ring/body |
| Hi-hat / cymbals | No fizzy exaggeration on attack boost; sustain cut cleans bleed |
| Full drum bus | Independent control of punch vs. body; no pumping |
| Bass guitar | Pick attack separable from sustain tone; no intermodulation |
| Vocals | Consonant presence boost without sibilance increase |
| Full mix | Subtle punch/clarity enhancement; no stereo shift; no artifacts |
| Acoustic guitar | Pick articulation; strum definition; no noise exaggeration |
| Synth pads | Should be minimally affected (no false transients) |

### 10.5 CPU/Latency Profiling

Measure processing time per buffer on target hardware. For a shipping plugin, the target is < 1% of a single core at 44.1 kHz stereo with a 64-sample buffer. For 96 kHz, double the computation but the budget scales proportionally.

Profile with:
- Minimum buffer size (32 samples) — worst-case overhead-per-sample
- Typical buffer size (256 samples) — nominal performance
- Large buffer size (2048 samples) — best-case throughput

---

## 11. Product / UX Guidance

### 11.1 Parameter Definitions

| Parameter | What It Controls | Range | Default |
|---|---|---|---|
| Attack | Gain applied during transient onsets | -12 to +12 dB | 0 dB |
| Sustain | Gain applied during non-transient phases | -12 to +12 dB | 0 dB |
| Sensitivity | How easily transients are detected (maps to fast envelope time) | 0–100% | 50% |
| Speed | How quickly the effect responds (maps to slow envelope time) | 0–100% | 50% |
| Mix | Wet/dry blend | 0–100% | 100% |
| Output Trim | Post-processing level adjustment | -12 to +6 dB | 0 dB |
| Stereo Link | How much L/R detection is coupled | 0–100% | 80% |
| Crossover Low | Low/mid split frequency | 60–500 Hz | 200 Hz |
| Crossover High | Mid/high split frequency | 1–12 kHz | 4 kHz |
| Lookahead | Pre-delay for detection accuracy | 0–5 ms | 2 ms |
| Range | Maximum gain change allowed | 0–24 dB | 12 dB |
| Character | Soft (smooth curves) to Hard (aggressive shaping) | Soft/Med/Hard | Medium |

### 11.2 Recommended Control Hierarchy

**Beginner Mode (3 controls):**
- Attack (single knob, broadband)
- Sustain (single knob, broadband)
- Mix

This covers 80% of use cases. Internal parameters are set to sensible defaults.

**Standard Mode (7–8 controls):**
- Per-band Attack (low / mid / high)
- Per-band Sustain (low / mid / high)
- Mix
- Output Trim

Crossover frequencies at fixed defaults (200 Hz, 4 kHz). Sensitivity, speed, stereo link at defaults.

**Advanced Mode (all controls):**
- Per-band Attack and Sustain
- Crossover frequencies (adjustable)
- Sensitivity
- Speed
- Stereo Link
- Lookahead
- Range
- Character
- Mix
- Output Trim

### 11.3 Visual Feedback

The most useful visual feedback for a transient shaper is:

- **Gain reduction/boost meter:** A real-time meter showing the instantaneous gain applied. This should move fast enough to show transient boosts as brief spikes.
- **Waveform overlay:** Input waveform with the gain envelope overlaid, showing where boost and cut are being applied.
- **Per-band activity indicators:** In multiband mode, small meters or LEDs showing transient detection activity per band.
- **Before/after envelope comparison:** Show the input and output envelopes overlaid so the user can see how the transient profile is being reshaped.

---

## 12. Final Recommendation

### Best Overall Architecture to Build First

**Architecture B (Production Realtime Version)** with a simplified UI. The multiband crossover adds modest implementation complexity but provides dramatically more useful and controllable results. Starting with a broadband-only V1 will require a near-total rewrite to add multiband later, so it is more efficient to build the multiband infrastructure from the start and expose it through a beginner-mode UI with a single Attack and Sustain knob (summing the per-band gains internally).

### Best Path to Multiband Design

Use **LR4 IIR crossovers** with **3 bands** and the correct signal-path topology described in §6.2.1. Per-band dual-envelope transient detection with band-appropriate time constants (longer for low frequencies, shorter for high frequencies). This is the simplest multiband architecture that produces professional results.

### Most Important Design Choices to Get Right Early

1. **Envelope follower time constants.** These define the character of the entire effect. Get the fast and slow envelope time constants right for each band, and the transient shaper will sound good. Get them wrong, and no amount of sophistication will fix it. Budget significant time for listening-driven tuning of these values.

2. **Gain smoothing.** Poor gain smoothing produces audible clicks and unmusical pumping. Asymmetric smoothing (fast attack, slower release) is essential.

3. **Sidechain highpass filter for the low band.** Without this, the detector will track individual bass waveform cycles and produce distortion. The HPF frequency (40–80 Hz) and order (1st or 2nd) matter.

4. **Normalized transient signal.** Dividing by the slow envelope makes the effect level-independent. Without normalization, the transient detector is more sensitive to loud signals than quiet ones, which is usually the wrong behavior.

5. **Crossover topology.** Using the correct LR4 topology (§6.2.1) ensures perfect magnitude reconstruction. Getting this wrong produces permanent tonal coloration independent of the transient shaping.

### What to Defer Until Later

- Energy-flux or spectral-flux detection (dual-envelope is sufficient for V1 and V2)
- Mid/side processing
- Adaptive time constants
- Oversampling
- Wavelet decomposition
- Cross-band interaction logic
- Source-dependent mode switching
- Spectral/STFT domain processing

These are all genuine improvements, but none of them are necessary for a transient shaper that sounds good and is useful. The dual-envelope method with LR4 crossovers and careful tuning is the architecture used (in various forms) by the majority of commercial transient shapers, and it works well.

---

## 13. Stretch Topics

### 13.1 Transient Shaping in Mid/Side

Process the mid (center) and side (stereo difference) signals independently. This allows:

- Boosting attack on the center (kick, snare, vocals) without affecting panned elements
- Reducing sustain on the sides (room ambiance) without affecting center content
- Widening the stereo image during transients by boosting side attack

Implementation: M = (L+R)/2, S = (L-R)/2. Process M and S through independent transient shapers. Reconvert: L = M+S, R = M-S.

**Caution:** Aggressive mid/side transient shaping can produce unusual spatial effects. Use with subtlety.

### 13.2 Transient Shaping in Spectral/STFT Domain

Apply transient detection per-frequency-bin in the STFT domain. Each bin has its own envelope follower and gain. This enables "spectral transient shaping" — boosting the onset of specific frequency components independently.

This approach is used in some advanced audio restoration and sound design tools. It provides the most granular control but at significant CPU and latency cost. The main challenge is phase handling — modifying magnitudes without corresponding phase adjustments can produce "phasiness" artifacts.

### 13.3 Adaptive Transient Shaping Based on Source Classification

Use a simple source classifier (based on spectral centroid, spectral flatness, and zero-crossing rate) to automatically adjust transient shaping parameters:

- **Percussive source (high spectral flatness, high ZCR):** Use faster time constants, higher sensitivity
- **Tonal source (low spectral flatness, low ZCR):** Use slower time constants, lower sensitivity
- **Mixed source:** Intermediate settings

This could be implemented as a "Smart" mode that automatically adapts to the material.

### 13.4 Oversampling Strategy

Oversampling (2× or 4×) is beneficial when:

- Using aggressive transient boost (>6 dB) that produces peaks exceeding 0 dBFS
- Using the soft limiter/clipper stage, which introduces nonlinear distortion that produces harmonics above Nyquist

For the transient detection and gain application stages themselves, oversampling provides minimal benefit — the envelope followers operate at time scales much longer than the sample period.

**Recommendation:** If including a soft limiter or saturation stage, offer optional 2× oversampling on that stage only. Do not oversample the detection or crossover stages.

### 13.5 Combining Transient Shaping with Saturation / Dynamic EQ

**Transient shaping + saturation:** Apply saturation only during the transient phase. This adds harmonic richness and "grit" to transients without affecting the sustain character. The transient detector drives both the gain stage and a saturation wet/dry control.

**Transient shaping + dynamic EQ:** Use the transient detector to trigger a dynamic EQ boost or cut. For example, boost 3 kHz by 4 dB only during transient events — this adds "click" to kick drums without permanently altering the tonal balance.

**Transient shaping + clipping:** Use the transient signal to drive a soft clipper's threshold. During sustain, the clipper threshold is at 0 dBFS (no clipping). During transients, the threshold is lowered, clipping the transient peaks. This produces a unique "compressed punch" character different from either compression or transient cutting.

### 13.6 Comparison to SPL Transient Designer Conceptual Approach

The SPL Transient Designer (patented by SPL, designed by HP Willner) is the original hardware transient shaper and the benchmark for the category. Its published design uses a **differential envelope** approach:

The signal passes through two parallel envelope detectors — one with a fast time constant and one with a slow time constant. The difference between these envelopes drives a VCA (voltage-controlled amplifier) that modulates the signal gain. The Attack knob scales the fast-envelope contribution; the Sustain knob scales the slow-envelope contribution (or more precisely, the inverse/complement of the slow envelope).

Key characteristics of the SPL approach:

- **Threshold-free:** No threshold parameter. The effect responds to the shape of the signal regardless of level.
- **VCA-based gain:** The gain modulation is continuous and smooth, driven by analog envelope circuits.
- **Simple controls:** Only Attack and Sustain knobs (plus output level).
- **Broadband:** No frequency splitting.

The digital implementation described in this report (Architecture A) is conceptually equivalent to the SPL approach, with the normalized differential envelope replacing the analog VCA drive signal. The multiband extensions (Architectures B and C) go beyond the original SPL concept.

### 13.7 Patent / Prior Art Awareness

The SPL Transient Designer is covered by patents (DE 100 27 089, US 6,795,740) which describe the specific analog circuit implementation. The *concept* of using differential envelope followers for transient detection is not patentable — it is a well-known signal processing technique. However, specific circuit or algorithm implementations may be covered.

**Key considerations:**

- The general approach of dual-envelope transient detection with differential gain is well-established in the prior art and the academic literature on onset detection.
- Specific control schemes, parameter mappings, or novel detection algorithms may be patentable.
- The SPL patents cover the specific analog VCA circuit, not the digital algorithm.
- Any commercial implementation should undergo independent patent review.

**This report does not constitute legal advice. Consult a patent attorney before commercial use of any specific implementation.**

---

*End of Report*

---

**Appendix: Key References and Prior Art**

The following areas of existing literature and practice inform the techniques described in this report:

- Bello et al., "A Tutorial on Onset Detection in Music Signals" (IEEE TASLP, 2005) — foundational work on onset detection methods including spectral flux and energy flux
- Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals" (JASA, 1998) — comb filter and autocorrelation methods for rhythmic analysis with relevant envelope follower designs
- Zölzer, "DAFX: Digital Audio Effects" (Wiley) — standard reference for audio DSP including envelope followers, dynamics processors, and filterbank design
- SPL Transient Designer patent (US 6,795,740) — the canonical hardware implementation
- Linkwitz, "Active Crossover Networks for Noncoincident Drivers" (JAES, 1976) — foundational crossover design
- JUCE / iPlug2 / FAUST DSP frameworks — common implementation environments for audio plugin development
- Giannoulis et al., "Digital Dynamic Range Compressor Design — A Tutorial and Analysis" (JAES, 2012) — comprehensive treatment of envelope follower design and gain smoothing applicable to transient shaping

---

*Document version 1.0. For internal engineering use.*
