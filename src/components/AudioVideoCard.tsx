/**
 * AudioVideoCard.tsx
 *
 * Generates a proper MP4 video from a voice drop:
 *  - Visual: animated equalizer bars + username wallpaper + avatar — rendered on Canvas
 *  - Audio: decoded from Cloudinary URL, re-encoded as AAC
 *  - Container: H.264 + AAC muxed into .mp4 via WebCodecs API + mp4-muxer
 *  - Output: downloads as `.mp4` that plays in WhatsApp, VLC, QuickTime, gallery apps
 *
 * Browser requirements: Chrome 94+, Safari 16.4+, Edge 94+, Firefox 130+
 */

import React, { useState } from 'react';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { UserProfile, Message } from '../types';
import { Video, Loader2, AlertCircle, CheckCircle2, Share2 } from 'lucide-react';
import { motion } from 'motion/react';

// ─── Constants ───────────────────────────────────────────────────────────────

const FPS         = 30;
const WIDTH       = 1080;
const HEIGHT      = 1920;   // 9:16 portrait — fills WhatsApp/story viewport
const VID_BITRATE = 3_000_000; // 3 Mbps H.264
const AUD_BITRATE = 128_000;   // 128 kbps AAC
const BAR_COUNT   = 48;        // equalizer bar count

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Load a URL into an HTMLImageElement with CORS */
function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

/**
 * Pre-compute per-frame bar heights (0–1) from the decoded AudioBuffer.
 * We split each frame's audio window into BAR_COUNT equal sub-bands and
 * compute the RMS amplitude of each — gives an authentic pseudo-frequency display.
 */
function computeFrameBars(decoded: AudioBuffer): Float32Array[] {
  const ch = decoded.getChannelData(0);
  const spf = Math.max(1, Math.floor(decoded.sampleRate / FPS)); // samples per frame
  const spb = Math.max(1, Math.floor(spf / BAR_COUNT));          // samples per bar
  const totalFrames = Math.ceil(decoded.duration * FPS);
  const frames: Float32Array[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const bars = new Float32Array(BAR_COUNT);
    const fStart = f * spf;
    for (let b = 0; b < BAR_COUNT; b++) {
      let rms = 0;
      const start = fStart + b * spb;
      const end   = Math.min(start + spb, ch.length);
      if (end > start) {
        for (let s = start; s < end; s++) rms += ch[s] * ch[s];
        bars[b] = Math.min(1, Math.sqrt(rms / (end - start)) * 5); // amplify
      }
    }
    frames.push(bars);
  }
  return frames;
}

/**
 * Render one video frame onto a 2D canvas context.
 * Design: black background → subtle grid → username ghost wallpaper →
 *         avatar ring → display name → VOICE DROP badge → equalizer bars →
 *         playhead progress → Anonboard watermark footer.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  profile: UserProfile,
  bars: Float32Array,
  frameIndex: number,
  totalFrames: number,
  avatar: HTMLImageElement | null,
) {
  const W = WIDTH, H = HEIGHT, cx = W / 2;

  // Background — radial gradient for depth
  const bg = ctx.createRadialGradient(cx, H * 0.4, 0, cx, H * 0.4, H * 0.75);
  bg.addColorStop(0, '#111111');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle 40px grid
  ctx.strokeStyle = 'rgba(255,255,255,0.022)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ── Username ghost wallpaper ─────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = (profile.displayName || 'ANONBOARD').toUpperCase();
  let fs = 260;
  ctx.font = `900 ${fs}px sans-serif`;
  while (ctx.measureText(name).width > W * 0.92 && fs > 60) {
    fs -= 8;
    ctx.font = `900 ${fs}px sans-serif`;
  }
  ctx.fillText(name, cx, H * 0.5);
  ctx.restore();

  // ── Top header bar ───────────────────────────────────────────────────────
  ctx.fillStyle = '#00FF88';
  ctx.font = '900 28px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('👻 ANONBOARD', 60, 80);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '700 26px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('VOICE DROP', W - 60, 80);

  // Top divider
  ctx.strokeStyle = 'rgba(0,255,136,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 110); ctx.lineTo(W - 60, 110); ctx.stroke();

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avR = 120;
  const avX = cx;
  const avY = H * 0.3;

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = '#00FF88';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = '#00FF88';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avX, avY, avR + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Avatar clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  if (avatar) {
    ctx.clip();
    ctx.drawImage(avatar, avX - avR, avY - avR, avR * 2, avR * 2);
  } else {
    ctx.clip();
    ctx.font = `${avR * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👻', avX, avY);
  }
  ctx.restore();

  // ── Display name ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(profile.displayName?.toUpperCase() || 'ANONYMOUS', cx, avY + avR + 80);

  // ── VOICE DROP badge ──────────────────────────────────────────────────────
  const bdY = avY + avR + 165;
  const bdText = '🎙  ANONYMOUS VOICE DROP';
  ctx.font = '900 30px sans-serif';
  const bdW = ctx.measureText(bdText).width + 56;
  const bdH = 60;
  ctx.fillStyle = '#00FF88';
  ctx.beginPath();
  (ctx as any).roundRect(cx - bdW / 2, bdY - bdH / 2, bdW, bdH, 12);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bdText, cx, bdY);

  // ── Equalizer bars ────────────────────────────────────────────────────────
  const barAreaTop = H * 0.62;
  const barAreaH   = 240;
  const totalBarW  = W - 120;
  const barW       = Math.floor(totalBarW / BAR_COUNT) - 3;
  const barStep    = Math.floor(totalBarW / BAR_COUNT);

  for (let b = 0; b < BAR_COUNT; b++) {
    const amp = bars[b];
    const bH  = Math.max(10, amp * barAreaH);
    const bX  = 60 + b * barStep;
    const bY  = barAreaTop + barAreaH - bH;

    const grad = ctx.createLinearGradient(bX, bY, bX, bY + bH);
    grad.addColorStop(0, '#00FF88');
    grad.addColorStop(0.5, '#00CC66');
    grad.addColorStop(1, '#003322');
    ctx.fillStyle = grad;
    ctx.beginPath();
    (ctx as any).roundRect(bX, bY, Math.max(2, barW), bH, 3);
    ctx.fill();
  }

  // ── Playhead progress bar ─────────────────────────────────────────────────
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const pbY = H - 180;
  const pbW = W - 120;

  // Track
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  (ctx as any).roundRect(60, pbY, pbW, 8, 4);
  ctx.fill();
  // Fill
  if (progress > 0) {
    ctx.fillStyle = '#00FF88';
    ctx.beginPath();
    (ctx as any).roundRect(60, pbY, pbW * progress, 8, 4);
    ctx.fill();
  }
  // Scrubber dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(60 + pbW * progress, pbY + 4, 12, 0, Math.PI * 2);
  ctx.fill();

  // Time labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 26px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const elapsed = frameIndex / FPS;
  const total   = totalFrames / FPS;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  ctx.fillText(fmt(elapsed), 60, pbY + 40);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(total), W - 60, pbY + 40);

  // ── Footer watermark ──────────────────────────────────────────────────────
  const wm = `👻 ANONBOARD · ${(profile.watermark || 'ANONYMOUS').toUpperCase()}`;
  ctx.fillStyle = profile.watermarkColor || '#444444';
  ctx.font = `800 26px ${profile.watermarkFont || 'monospace'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(wm, cx, H - 80);
}

// ─── Core generation function ─────────────────────────────────────────────────

export interface GenerateMP4Options {
  audioUrl: string;
  profile: UserProfile;
  messageId: string;
  onProgress?: (p: number) => void; // 0 → 1
}

export async function generateAudioVideoMP4(opts: GenerateMP4Options): Promise<Blob> {
  const { audioUrl, profile, messageId, onProgress } = opts;
  const prog = (p: number) => onProgress?.(p);

  // ── Guard: WebCodecs required ──────────────────────────────────────────────
  if (!('VideoEncoder' in window) || !('AudioEncoder' in window)) {
    throw new Error(
      'Your browser does not support video generation.\nPlease use Chrome 94+, Safari 16.4+, Edge 94+, or Firefox 130+.',
    );
  }

  // ── 1. Fetch + decode the audio ───────────────────────────────────────────
  prog(0.02);
  const rawAudio = await fetch(audioUrl).then(r => {
    if (!r.ok) throw new Error(`Failed to fetch audio (${r.status})`);
    return r.arrayBuffer();
  });
  const audioCtx = new AudioContext();
  const decoded  = await audioCtx.decodeAudioData(rawAudio);
  prog(0.08);

  // ── 2. Pre-compute equalizer bars ─────────────────────────────────────────
  const frameBars   = computeFrameBars(decoded);
  const totalFrames = frameBars.length;
  prog(0.11);

  // ── 3. Load avatar (best-effort) ──────────────────────────────────────────
  let avatar: HTMLImageElement | null = null;
  if (profile.avatarUrl) {
    try { avatar = await loadImg(profile.avatarUrl); } catch { /* fine */ }
  }

  // ── 4. Canvas setup ───────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // ── 5. Probe codec support ───────────────────────────────────────────────
  const videoConfig: VideoEncoderConfig = {
    codec:   'avc1.640028', // H.264 High Profile Level 4.0
    width:   WIDTH,
    height:  HEIGHT,
    bitrate: VID_BITRATE,
    framerate: FPS,
  };
  {
    const probe = await VideoEncoder.isConfigSupported(videoConfig);
    if (!probe.supported) {
      // Fallback: Main Profile Level 4.0
      videoConfig.codec = 'avc1.4D0028';
      const probe2 = await VideoEncoder.isConfigSupported(videoConfig);
      if (!probe2.supported) {
        throw new Error('H.264 video encoding is not supported on this device.');
      }
    }
  }

  // ── 6. mp4-muxer ─────────────────────────────────────────────────────────
  const target   = new ArrayBufferTarget();
  const numCh    = Math.min(decoded.numberOfChannels, 2);
  const muxer    = new Muxer({
    target,
    video: { codec: 'avc', width: WIDTH, height: HEIGHT },
    audio: { codec: 'aac', numberOfChannels: numCh, sampleRate: decoded.sampleRate },
    fastStart: 'in-memory',
  });

  // ── 7. VideoEncoder ───────────────────────────────────────────────────────
  let vidErr: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error:  (e) => { vidErr = e; },
  });
  videoEncoder.configure(videoConfig);

  // ── 8. AudioEncoder ──────────────────────────────────────────────────────
  let audErr: Error | null = null;
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error:  (e) => { audErr = e; },
  });
  audioEncoder.configure({
    codec:            'mp4a.40.2', // AAC-LC
    sampleRate:       decoded.sampleRate,
    numberOfChannels: numCh,
    bitrate:          AUD_BITRATE,
  });

  // ── 9. Encode video frames (render canvas → VideoFrame → encoder) ─────────
  for (let i = 0; i < totalFrames; i++) {
    if (vidErr) throw vidErr;

    drawFrame(ctx, profile, frameBars[i], i, totalFrames, avatar);

    const timestamp = Math.round((i / FPS) * 1_000_000);        // µs
    const duration  = Math.round(1_000_000 / FPS);              // µs
    const frame = new VideoFrame(canvas, { timestamp, duration });
    videoEncoder.encode(frame, { keyFrame: i % (FPS * 3) === 0 }); // key every 3s
    frame.close();

    // Progress 11% → 65%, yield every 5 frames to keep UI alive
    if (i % 5 === 0) {
      prog(0.11 + (i / totalFrames) * 0.54);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  await videoEncoder.flush();
  if (vidErr) throw vidErr;
  prog(0.67);

  // ── 10. Encode audio chunks ───────────────────────────────────────────────
  const CHUNK_SZ   = 4096; // samples per chunk
  const { length: totalSamples, sampleRate, numberOfChannels: srcCh } = decoded;

  for (let offset = 0; offset < totalSamples; offset += CHUNK_SZ) {
    if (audErr) throw audErr;
    const chunkLen = Math.min(CHUNK_SZ, totalSamples - offset);
    const ts       = Math.round((offset / sampleRate) * 1_000_000); // µs

    // Build planar Float32 buffer (ch0 samples, then ch1 samples)
    const data = new Float32Array(chunkLen * numCh);
    for (let c = 0; c < numCh; c++) {
      const src = c < srcCh ? decoded.getChannelData(c) : decoded.getChannelData(0);
      data.set(src.subarray(offset, offset + chunkLen), c * chunkLen);
    }

    const audioData = new AudioData({
      format:           'f32-planar',
      sampleRate,
      numberOfFrames:   chunkLen,
      numberOfChannels: numCh,
      timestamp:        ts,
      data,
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
  if (audErr) throw audErr;
  prog(0.95);

  // ── 11. Finalize ──────────────────────────────────────────────────────────
  muxer.finalize();
  const { buffer } = target;
  await audioCtx.close();
  prog(1.0);

  return new Blob([buffer], { type: 'video/mp4' });
}

// ─── React component ─────────────────────────────────────────────────────────

interface AudioVideoExporterProps {
  message: Message;
  profile: UserProfile;
}

type ExportState = 'idle' | 'generating' | 'done' | 'error';

export default function AudioVideoExporter({ message, profile }: AudioVideoExporterProps) {
  const [state,    setState]    = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const [errMsg,   setErrMsg]   = useState('');

  const handleExport = async () => {
    if (!message.audioUrl) return;
    setState('generating');
    setProgress(0);
    setErrMsg('');

    try {
      const blob = await generateAudioVideoMP4({
        audioUrl:   message.audioUrl,
        profile,
        messageId:  message.id,
        onProgress: setProgress,
      });

      const filename = `anonboard-voice-${message.id}.mp4`;
      const file = new File([blob], filename, { type: 'video/mp4' });

      // Mobile: try Web Share API (pushes directly to WhatsApp share sheet)
      if (
        typeof navigator.share === 'function' &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: '👻 Anonymous Voice Drop',
          text:  'Someone sent you a voice drop on Anonboard',
        });
      } else {
        // Desktop: trigger download
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      setState('done');
      setTimeout(() => setState('idle'), 4000);
    } catch (err: any) {
      console.error('AudioVideoCard generation failed:', err);
      setErrMsg(err.message || 'Generation failed. Please try again.');
      setState('error');
    }
  };

  // ── Idle state — export button ────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all active:scale-95"
      >
        <Video className="w-3.5 h-3.5" />
        Export as Video
      </button>
    );
  }

  // ── Generating ────────────────────────────────────────────────────────────
  if (state === 'generating') {
    const pct = Math.round(progress * 100);
    return (
      <div className="flex flex-col gap-2 p-3 bg-surface border border-grid-line rounded-xl">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">
            {pct < 12 ? 'Decoding audio...' :
             pct < 65 ? `Rendering frames… ${pct}%` :
             pct < 95 ? 'Encoding audio...' :
             'Finalising MP4...'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-[10px] font-black uppercase tracking-widest">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Video ready — check your downloads
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-bold leading-relaxed">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{errMsg}</span>
      </div>
      <button
        onClick={() => { setState('idle'); setErrMsg(''); }}
        className="text-[10px] font-black uppercase tracking-widest text-text-dim hover:text-white transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
