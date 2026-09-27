import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import {
  Ghost, ArrowRight, Check, ImageIcon, Trash2,
  Video, Mic, MicOff, Play, Pause, RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
const CLOUDINARY_CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME  || '';
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;

const MAX_VIDEO_MB  = 50;
const MAX_RECORD_SEC = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

type MediaMode = 'none' | 'images' | 'video' | 'audio';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMicMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function uploadToCloudinary(
  blob: Blob,
  recipientUid: string,
  folder: string,
): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', `anonboard/${recipientUid}/${folder}`);
  fd.append('quality', 'auto:good'); // smart compression — preserves resolution
  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  return json.secure_url as string;
}

// ─── Waveform preview (decorative) ───────────────────────────────────────────
function FakeWaveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex items-center gap-0.5 h-8">
      {bars.map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all ${active ? 'bg-red-400' : 'bg-accent/40'}`}
          style={{
            height: active
              ? `${20 + Math.abs(Math.sin(Date.now() / 120 + i * 0.6)) * 60}%`
              : `${15 + Math.sin(i * 0.9) * 12}%`,
            transition: active ? 'height 0.08s ease' : 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SendMessage() {
  const { username } = useParams();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [content,   setContent]   = useState('');
  const [category,  setCategory]  = useState<'feedback' | 'question' | 'compliment' | 'general'>('general');
  const [sent,      setSent]      = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [error,     setError]     = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  // ── Media state ──────────────────────────────────────────────────────────
  const [mediaMode, setMediaMode] = useState<MediaMode>('none');
  const [images,    setImages]    = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // ── Audio recording state ─────────────────────────────────────────────────
  const [isRecording,  setIsRecording]  = useState(false);
  const [recordSec,    setRecordSec]    = useState(0);
  const [audioBlob,    setAudioBlob]    = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<BlobPart[]>([]);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  const categories = [
    { id: 'general',    label: 'General',    emoji: '👻' },
    { id: 'feedback',   label: 'Feedback',   emoji: '📈' },
    { id: 'question',   label: 'Question',   emoji: '❓' },
    { id: 'compliment', label: 'Compliment', emoji: '✨' },
  ];

  // ── Recipient lookup ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRecipient = async () => {
      if (!username) { setError('No user specified'); setLoading(false); return; }
      try {
        const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRecipient(snap.docs[0].data() as UserProfile);
        } else {
          const docSnap = await getDoc(doc(db, 'users', username));
          docSnap.exists() ? setRecipient(docSnap.data() as UserProfile) : setError('User not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch user. Ensure the link is correct.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipient();
  }, [username]);

  // Cleanup audio preview URL on unmount
  useEffect(() => () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
  }, [audioPreviewUrl]);

  // ── Image handling ───────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files) as File[];
    if (images.length + selected.length > 3) { alert('Max 3 images.'); return; }
    const valid = selected.filter(f => {
      if (f.size > 5 * 1024 * 1024) { alert(`${f.name} is larger than 5MB.`); return false; }
      return true;
    });
    const next = [...images, ...valid].slice(0, 3);
    setImages(next);
    if (next.length > 0) setMediaMode('images');
  };
  const removeImage = (i: number) => {
    const next = images.filter((_, j) => j !== i);
    setImages(next);
    if (next.length === 0) setMediaMode('none');
  };

  // ── Video handling ───────────────────────────────────────────────────────
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const f = e.target.files[0];
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) { alert(`Video must be under ${MAX_VIDEO_MB}MB.`); return; }
    setVideoFile(f);
    setMediaMode('video');
  };
  const removeVideo = () => { setVideoFile(null); setMediaMode('none'); };

  // ── Audio recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMicMimeType();
      
      const audioCtx = new window.AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      
      // Ring modulation for "Dalek / Hacker" effect
      const vca = audioCtx.createGain();
      vca.gain.value = 0;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 50; // Robotic pitch
      osc.start();
      osc.connect(vca.gain);
      source.connect(vca);
      
      // Lowpass filter for "radio/comms" muffle
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800; 
      vca.connect(filter);
      
      // Mix a tiny bit of dry signal so it's intelligible
      const dryGain = audioCtx.createGain();
      dryGain.gain.value = 0.4;
      source.connect(dryGain);
      dryGain.connect(filter);
      
      const dest = audioCtx.createMediaStreamDestination();
      filter.connect(dest);
      
      const targetStream = dest.stream;
      (mediaRecRef as any).audioCtx = audioCtx;

      const recorder = new MediaRecorder(targetStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        if ((mediaRecRef as any).audioCtx) {
          (mediaRecRef as any).audioCtx.close();
          (mediaRecRef as any).audioCtx = null;
        }
      };
      recorder.start(100); // collect data every 100ms
      mediaRecRef.current = recorder;
      setIsRecording(true);
      setRecordSec(0);
      setMediaMode('audio');

      // Timer
      timerRef.current = setInterval(() => {
        setRecordSec(s => {
          if (s + 1 >= MAX_RECORD_SEC) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Could not access microphone. Please allow mic permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
    setIsRecording(false);
  };

  const reRecord = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl('');
    setIsPlayingPreview(false);
    setRecordSec(0);
    setMediaMode('none');
    previewAudio.current?.pause();
  };

  const togglePreview = () => {
    if (!previewAudio.current) {
      previewAudio.current = new Audio(audioPreviewUrl);
      previewAudio.current.onended = () => setIsPlayingPreview(false);
    }
    if (isPlayingPreview) {
      previewAudio.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudio.current.play();
      setIsPlayingPreview(true);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasMedia = (mediaMode === 'images' && images.length > 0) || (mediaMode === 'video' && videoFile) || (mediaMode === 'audio' && audioBlob);
    if ((!content.trim() && !hasMedia) || !recipient) return;
    setLoading(true);
    setSubmitError('');
    try {
      let imageUrls: string[] = [];
      let videoUrls: string[] = [];
      let audioUrl: string | undefined;

      if (mediaMode === 'images' && images.length > 0) {
        setUploadProgress('Uploading images…');
        imageUrls = await Promise.all(
          images.map(f => uploadToCloudinary(f, recipient.uid, 'images')),
        );
      }
      if (mediaMode === 'video' && videoFile) {
        setUploadProgress('Uploading video…');
        videoUrls = [await uploadToCloudinary(videoFile, recipient.uid, 'videos')];
      }
      if (mediaMode === 'audio' && audioBlob) {
        setUploadProgress('Uploading voice drop…');
        audioUrl = await uploadToCloudinary(audioBlob, recipient.uid, 'audio');
      }

      let finalContent = content.trim();
      if (!finalContent) {
        if (mediaMode === 'audio') finalContent = '🎙️ Voice Drop';
        else if (mediaMode === 'video') finalContent = '🎥 Video Drop';
        else if (mediaMode === 'images') finalContent = '📷 Image Drop';
      }

      setUploadProgress('Sending drop…');
      await addDoc(collection(db, 'users', recipient.uid, 'messages'), {
        content: finalContent,
        recipientUid: recipient.uid,
        category,
        ...(imageUrls.length > 0 && { imageUrls }),
        ...(videoUrls.length > 0 && { videoUrls }),
        ...(audioUrl && { audioUrl }),
        createdAt: serverTimestamp(),
        reactions: {},
      });

      setSent(true);
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#00FF88', '#FFFFFF', '#141414'],
      });
    } catch (err: any) {
      console.error(err);
      setSubmitError('Failed to send. Attachment might be too large — please try again.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  // ── Error / loading states ────────────────────────────────────────────────
  if (loading && !recipient && !error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Ghost className="w-12 h-12 text-white animate-pulse" />
      </div>
    );
  }
  if (error || (!loading && !recipient)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-10 text-center">
        <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-8 border border-red-500/50">
          <Ghost className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">404 — Nobody here</h2>
        <p className="text-text-dim text-sm max-w-sm mb-8">{error}</p>
        <Link to="/" className="px-6 py-3 bg-surface border border-grid-line text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 sm:px-10 py-12 sm:py-20">
      {/* Header */}
      <div className="text-center mb-12 space-y-4">
        <div className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-accent">CONFESSIONAL</div>
        <div className="relative inline-block">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-surface border border-grid-line p-1 rounded-3xl mb-4 mx-auto overflow-hidden">
            {recipient?.avatarUrl ? (
              <img src={recipient.avatarUrl} alt="" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-bg rounded-2xl">
                <Ghost className="w-10 h-10 text-white" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-accent text-black p-1.5 rounded-full shadow-lg">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic leading-tight">
          Send to {recipient?.displayName}
        </h2>
        <p className="text-text-dim font-bold uppercase text-[11px] tracking-tight">Zero traces left behind.</p>
      </div>

      {/* Category */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id as any)}
            className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-all ${
              category === cat.id
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-surface border-grid-line text-text-dim hover:border-white/20'
            }`}
          >
            <span className="text-lg">{cat.emoji}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Textarea */}
        <div className="relative group">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={loading}
            placeholder="TYPE YOUR MESSAGE…"
            className="w-full h-48 sm:h-56 bg-surface border border-grid-line rounded-2xl p-6 sm:p-10 text-xl sm:text-2xl font-bold text-white placeholder:text-white/5 focus:outline-none focus:border-accent transition-all resize-none shadow-2xl"
            maxLength={1000}
            required
          />
          <div className="absolute bottom-4 right-6 text-[9px] font-black tracking-[0.2em] text-text-dim uppercase">
            {content.length}/1000
          </div>
        </div>

        {/* ── Image previews ───────────────────────────────────────────────── */}
        {mediaMode === 'images' && images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((file, i) => (
              <div key={i} className="relative aspect-square rounded-xl bg-bg border border-grid-line overflow-hidden group/img">
                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Video preview ─────────────────────────────────────────────────── */}
        {mediaMode === 'video' && videoFile && (
          <div className="relative rounded-2xl bg-bg border border-grid-line overflow-hidden">
            <video src={URL.createObjectURL(videoFile)} className="w-full max-h-52 object-contain" controls muted />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-xl text-white backdrop-blur-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
              {videoFile.name} · {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
            </p>
          </div>
        )}

        {/* ── Audio recording UI ────────────────────────────────────────────── */}
        {mediaMode === 'audio' && (
          <div className="rounded-2xl bg-surface border border-grid-line overflow-hidden">
            {isRecording ? (
              /* Recording in progress */
              <div className="p-5 flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                </div>
                <div className="flex-1 min-w-0">
                  <FakeWaveform active={true} />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-red-400 text-sm font-black tabular-nums">
                    {fmtTime(recordSec)} / {fmtTime(MAX_RECORD_SEC)}
                  </span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <MicOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : audioBlob ? (
              /* Preview recorded audio */
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                  >
                    {isPlayingPreview ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-0.5" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1.5">Voice Drop Ready</p>
                    <FakeWaveform active={isPlayingPreview} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-text-dim text-[10px] font-black tabular-nums">{fmtTime(recordSec)}</span>
                    <button
                      type="button"
                      onClick={reRecord}
                      className="flex items-center gap-1 text-text-dim hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Re-record
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-text-dim font-black uppercase tracking-widest border-t border-grid-line pt-3">
                  🎙 The recipient can export this as an MP4 video card to share on WhatsApp
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Submit error ────────────────────────────────────────────────────── */}
        {submitError && (
          <p className="text-red-400 text-xs font-bold bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">
            {submitError}
          </p>
        )}

        {/* ── Media buttons + Submit row ───────────────────────────────────── */}
        <div className="flex gap-3">
          {/* Image */}
          {mediaMode === 'none' || mediaMode === 'images' ? (
            <label className={`w-14 shrink-0 flex items-center justify-center border rounded-xl cursor-pointer transition-all ${
              (images.length >= 3 || loading)
                ? 'border-grid-line/30 text-white/10'
                : 'bg-surface border-grid-line text-text-dim hover:text-white hover:border-white/20'
            }`}>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={handleImageChange} disabled={images.length >= 3 || loading} />
              <ImageIcon className="w-5 h-5" />
            </label>
          ) : null}

          {/* Video */}
          {mediaMode === 'none' ? (
            <label className={`w-14 shrink-0 flex items-center justify-center border rounded-xl cursor-pointer transition-all ${
              loading
                ? 'border-grid-line/30 text-white/10'
                : 'bg-surface border-grid-line text-text-dim hover:text-white hover:border-white/20'
            }`}>
              <input type="file" accept="video/*" className="hidden"
                onChange={handleVideoChange} disabled={loading} />
              <Video className="w-5 h-5" />
            </label>
          ) : null}

          {/* Mic */}
          {mediaMode === 'none' ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={loading}
              className="w-14 shrink-0 flex items-center justify-center border bg-surface border-grid-line text-text-dim rounded-xl hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
              title="Record Anonymous Voice Drop (Voice Mask Active)"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || (!content.trim() && images.length === 0 && !videoFile && !audioBlob)}
            className="flex-1 flex items-center justify-center gap-3 py-4 sm:py-6 bg-accent text-black rounded-xl font-black text-lg sm:text-2xl uppercase italic tracking-tighter transition-all active:scale-95 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            {loading
              ? (uploadProgress || 'SENDING…')
              : (<>DROP ANONYMOUSLY <ArrowRight className="w-5 h-5 stroke-[3]" /></>)
            }
          </button>
        </div>
      </form>

      {/* Success modal */}
      <AnimatePresence>
        {sent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative z-10 w-full max-w-md bg-surface border border-grid-line rounded-3xl p-8 sm:p-12 text-center"
            >
              <div className="w-20 h-20 bg-accent text-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,255,136,0.3)]">
                <Check className="w-10 h-10 stroke-[4]" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-3">SENT!</h2>
              <p className="text-text-dim mb-8 uppercase font-black tracking-widest text-xs">
                Anonymous drop complete for {recipient?.displayName}.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/" className="w-full py-4 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95">
                  Create Your Own Board
                </Link>
                <button
                  onClick={() => {
                    setSent(false);
                    setContent('');
                    setImages([]);
                    setVideoFile(null);
                    setAudioBlob(null);
                    setAudioPreviewUrl('');
                    setMediaMode('none');
                    setRecordSec(0);
                  }}
                  className="w-full py-4 bg-transparent border border-grid-line text-text-dim rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
                >
                  Send Another Drop
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
