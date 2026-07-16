// Sound and Vibration Feedback utility using browser Web Audio API & Vibration API

// Keep a reference to the active/unlocked audio context
let globalAudioCtx = null;

const getAudioContext = () => {
  if (!globalAudioCtx) {
    globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (common browser security policy on mobile)
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(e => console.warn('AudioContext resume failed:', e));
  }
  return globalAudioCtx;
};

// Play synth sound effects
export const playSound = (type, enabled = true) => {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Use triangle wave instead of sine for fuller, louder audio on mobile speakers
    osc.type = 'triangle';
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'tick') {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'reveal_civilian') {
      // Pleasant Major arpeggio (transposed for mobile audibility)
      [392.00, 493.88, 587.33, 783.99].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
        g.gain.setValueAtTime(0.04, ctx.currentTime + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.25);
        o.start(ctx.currentTime + i * 0.08);
        o.stop(ctx.currentTime + i * 0.08 + 0.25);
      });
    } else if (type === 'reveal_mafia') {
      // Ominous minor/dissonant chord (transposed up to G4, G#4, B4 for phone speaker audibility)
      [392.00, 415.30, 493.88].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(f, ctx.currentTime);
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start();
        o.stop(ctx.currentTime + 0.5);
      });
    } else if (type === 'vote') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } else if (type === 'elimination') {
      // Downward frequency sweep
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'win') {
      // Triumphant arpeggio
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12);
        g.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
        o.start(ctx.currentTime + i * 0.12);
        o.stop(ctx.currentTime + i * 0.12 + 0.35);
      });
    }
  } catch (e) {
    console.warn('Sound synthesiser fail:', e.message);
  }
};

// Trigger mobile haptic vibrations
export const triggerVibrate = (pattern = 100) => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    console.warn('Vibration API not supported:', e.message);
  }
};
