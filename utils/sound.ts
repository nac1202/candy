
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

  playSFX(type: 'correct' | 'wrong' | 'land' | 'gameover' | 'click' | 'mega_clear') {
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    switch (type) {
        case 'correct':
            // High pitched happy "ding"
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1); // C6
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            
            // Add a little sparkle (second osc)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(659.25, now); // E5
            gain2.gain.setValueAtTime(0.1, now);
            gain2.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc2.start(now);
            osc2.stop(now + 0.4);
            break;
            
        case 'wrong':
            // Low buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;

        case 'land':
            // Soft bounce (sine wave drop and slight rise)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            osc.frequency.linearRampToValueAtTime(140, now + 0.2); // slight rise
            gain.gain.setValueAtTime(0.0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.02); // soft attack
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;

        case 'gameover':
            // Falling slide
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(50, now + 1.0);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 1.0);
            osc.start(now);
            osc.stop(now + 1.0);
            break;
            
        case 'click':
            // Very short blip
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;

        case 'mega_clear':
            // Arpeggio up
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
            notes.forEach((freq, i) => {
                const t = now + (i * 0.05);
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'sine';
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.1, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                o.connect(g);
                g.connect(this.ctx.destination);
                o.start(t);
                o.stop(t + 0.2);
            });
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
