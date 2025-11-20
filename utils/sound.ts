
export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isBgmPlaying: boolean = false;
  private nextNoteTime = 0;
  private timerID: number | null = null;
  private sequenceIndex = 0;

  // A happy, pop-style pentatonic melody loop
  private melody = [
    // Bar 1
    { freq: 523.25, dur: 0.25 }, // C5
    { freq: 0, dur: 0.25 },
    { freq: 392.00, dur: 0.25 }, // G4
    { freq: 440.00, dur: 0.25 }, // A4
    // Bar 2
    { freq: 523.25, dur: 0.25 }, // C5
    { freq: 392.00, dur: 0.25 }, // G4
    { freq: 329.63, dur: 0.25 }, // E4
    { freq: 0, dur: 0.25 },
    // Bar 3
    { freq: 349.23, dur: 0.25 }, // F4
    { freq: 349.23, dur: 0.25 }, // F4
    { freq: 440.00, dur: 0.25 }, // A4
    { freq: 523.25, dur: 0.25 }, // C5
    // Bar 4
    { freq: 493.88, dur: 0.25 }, // B4
    { freq: 440.00, dur: 0.25 }, // A4
    { freq: 392.00, dur: 0.5  }, // G4
  ];

  constructor() {
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    } catch (e) {
      console.error('Web Audio API not supported');
    }
  }

  // Call this on first user interaction to unlock AudioContext
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM(false); // Don't reset 'playing' state flag, just stop sound
      if (this.ctx) this.ctx.suspend();
    } else {
      if (this.ctx) this.ctx.resume();
      if (this.isBgmPlaying) this.startLoop();
    }
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  // Helper to create a noise buffer for punchy sounds
  private createNoiseBuffer() {
      if (!this.ctx) return null;
      const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  }

  playSFX(type: 'correct' | 'wrong' | 'land' | 'gameover' | 'click' | 'mega_clear') {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    switch (type) {
        case 'correct':
            // Layer 1: High ping (Sine)
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now); // A5
            osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);

            // Layer 2: Sparkle (Triangle with vibrato effect via frequency slide)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1046.50, now); // C6
            osc2.frequency.linearRampToValueAtTime(1318.51, now + 0.1); // E6
            gain2.gain.setValueAtTime(0.2, now);
            gain2.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now);
            osc2.stop(now + 0.3);
            break;
            
        case 'wrong':
            // Dissonant Sawtooth
            const wOsc = this.ctx.createOscillator();
            const wGain = this.ctx.createGain();
            wOsc.type = 'sawtooth';
            wOsc.frequency.setValueAtTime(150, now);
            wOsc.frequency.linearRampToValueAtTime(80, now + 0.3);
            wGain.gain.setValueAtTime(0.2, now);
            wGain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            wOsc.connect(wGain);
            wGain.connect(this.ctx.destination);
            wOsc.start(now);
            wOsc.stop(now + 0.3);
            break;

        case 'land':
            // Heavy thud + squish
            const lOsc = this.ctx.createOscillator();
            const lGain = this.ctx.createGain();
            lOsc.type = 'sine';
            // Rapid pitch drop for impact
            lOsc.frequency.setValueAtTime(200, now);
            lOsc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
            
            lGain.gain.setValueAtTime(0.4, now);
            lGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            
            lOsc.connect(lGain);
            lGain.connect(this.ctx.destination);
            lOsc.start(now);
            lOsc.stop(now + 0.2);
            break;

        case 'gameover':
            // Descending Tri-tone
            const goOsc = this.ctx.createOscillator();
            const goGain = this.ctx.createGain();
            goOsc.type = 'sawtooth';
            goOsc.frequency.setValueAtTime(300, now);
            goOsc.frequency.exponentialRampToValueAtTime(50, now + 1.5);
            
            // LFO for wobble
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 10;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 20;
            lfo.connect(lfoGain);
            lfoGain.connect(goOsc.frequency);
            lfo.start(now);
            lfo.stop(now + 1.5);

            goGain.gain.setValueAtTime(0.3, now);
            goGain.gain.linearRampToValueAtTime(0, now + 1.5);
            
            goOsc.connect(goGain);
            goGain.connect(this.ctx.destination);
            goOsc.start(now);
            goOsc.stop(now + 1.5);
            break;
            
        case 'click':
            const cOsc = this.ctx.createOscillator();
            const cGain = this.ctx.createGain();
            cOsc.type = 'sine';
            cOsc.frequency.setValueAtTime(800, now);
            cGain.gain.setValueAtTime(0.1, now);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            cOsc.connect(cGain);
            cGain.connect(this.ctx.destination);
            cOsc.start(now);
            cOsc.stop(now + 0.05);
            break;

        case 'mega_clear':
            // Big Major Chord + Sparkles
            const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major
            chord.forEach((freq, i) => {
                const o = this.ctx!.createOscillator();
                const g = this.ctx!.createGain();
                o.type = i % 2 === 0 ? 'triangle' : 'sine';
                o.frequency.setValueAtTime(freq, now);
                // Slight slide up
                o.frequency.linearRampToValueAtTime(freq * 1.02, now + 0.5);
                
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                
                o.connect(g);
                g.connect(this.ctx!.destination);
                o.start(now);
                o.stop(now + 0.8);
            });

            // Noise burst "Explosion"
            const noiseBuffer = this.createNoiseBuffer();
            if (noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = noiseBuffer;
                const nGain = this.ctx.createGain();
                nGain.gain.setValueAtTime(0.3, now);
                nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                noise.connect(nGain);
                nGain.connect(this.ctx.destination);
                noise.start(now);
            }
            break;
    }
  }

  startBGM() {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.sequenceIndex = 0;
    this.startLoop();
  }

  stopBGM(reset = true) {
    if (reset) this.isBgmPlaying = false;
    if (this.timerID) {
        window.clearTimeout(this.timerID);
        this.timerID = null;
    }
  }

  private startLoop() {
    if (!this.isBgmPlaying || this.isMuted || !this.ctx) return;
    
    const scheduler = () => {
        if (!this.isBgmPlaying || !this.ctx) return;

        // Schedule notes for the next 100ms
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.sequenceIndex, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(scheduler, 25);
    };
    
    scheduler();
  }

  private nextNote() {
    const note = this.melody[this.sequenceIndex];
    this.nextNoteTime += note.dur;
    
    this.sequenceIndex++;
    if (this.sequenceIndex >= this.melody.length) {
        this.sequenceIndex = 0;
    }
  }

  private scheduleNote(index: number, time: number) {
    if (!this.ctx || this.isMuted) return;
    const note = this.melody[index];
    if (note.freq === 0) return; // Rest

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // "Marimba" style envelope
    osc.type = 'triangle';
    osc.frequency.value = note.freq;
    
    // Attack
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.02); 
    // Decay
    gain.gain.exponentialRampToValueAtTime(0.001, time + note.dur - 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + note.dur);
  }
}

export const soundManager = new SoundManager();
