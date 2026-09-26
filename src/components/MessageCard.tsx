import React, { useRef, useState } from 'react';
import { Message, UserProfile } from '../types';
import { Share2, Clock, Trash2, Download, Play, Pause, Video } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import AudioVideoExporter from './AudioVideoCard';

interface MessageCardProps {
  message: Message;
  onShare: (message: Message) => void;
  onDelete: (message: Message) => void | Promise<void>;
  profile?: UserProfile; // needed for AudioVideoCard
}

// ─── Reaction config ─────────────────────────────────────────────────────────
const REACTION_OPTIONS = ['🔥', '😂', '💀', '❤️', '👀', '💯'];

// ─── Inline audio player ──────────────────────────────────────────────────────
function AudioPlayer({ url, messageId }: { url: string; messageId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const a = new Audio(url);
      a.onended = () => { setPlaying(false); setProgress(0); };
      a.ontimeupdate = () => setProgress(a.currentTime / (a.duration || 1));
      a.onloadedmetadata = () => setDuration(a.duration);
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const toggle = () => {
    const a = ensureAudio();
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play().catch(console.error); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ensureAudio();
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * (a.duration || 0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-4 bg-bg border border-grid-line rounded-xl p-4">
      <button
        onClick={toggle}
        className="w-11 h-11 bg-accent rounded-full flex items-center justify-center text-black shrink-0 hover:scale-105 transition-transform active:scale-95"
      >
        {playing
          ? <Pause className="w-4 h-4 fill-black" />
          : <Play  className="w-4 h-4 fill-black translate-x-0.5" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">🎙 Voice Drop</p>
        {/* Seek bar */}
        <div
          className="w-full h-2 bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
          onClick={seek}
        >
          <div
            className="absolute left-0 top-0 h-full bg-accent rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          />
          {/* Animated bars (decorative, visible when not playing) */}
          {!playing && (
            <div className="absolute inset-0 flex items-center gap-px px-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="flex-1 bg-white/10 rounded-full"
                  style={{ height: `${30 + Math.sin(i * 0.8) * 50}%` }} />
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black tabular-nums text-text-dim mt-1">
          {fmt(progress * duration)} / {fmt(duration)}
        </p>
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────
const MessageCard: React.FC<MessageCardProps> = ({ message, onShare, onDelete, profile }) => {
  const [reacting, setReacting] = useState(false);
  const [sharingVideo, setSharingVideo] = useState(false);

  const handleReact = async (emoji: string) => {
    if (reacting) return;
    setReacting(true);
    try {
      const current = (message.reactions?.[emoji] as number) || 0;
      await updateDoc(doc(db, 'users', message.recipientUid, 'messages', message.id), {
        reactions: { ...message.reactions, [emoji]: current + 1 },
      });
    } catch (err) {
      console.error('Reaction update failed:', err);
    } finally {
      setReacting(false);
    }
  };

  /** Share a video file via Web Share API (mobile) or trigger download (desktop) */
  const handleShareVideo = async (videoUrl: string) => {
    setSharingVideo(true);
    try {
      const response = await fetch(videoUrl);
      const blob     = await response.blob();
      const filename = `anonboard-drop-${message.id}.mp4`;
      const file     = new File([blob], filename, { type: 'video/mp4' });

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '👻 Anonymous Drop',
          text:  'Someone sent me an anonymous video on Anonboard',
        });
      } else {
        // Desktop fallback — download
        const a  = document.createElement('a');
        a.href   = videoUrl;
        a.download = filename;
        a.click();
      }
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') console.error(err);
    } finally {
      setSharingVideo(false);
    }
  };

  return (
    <div className="group relative bg-surface border border-grid-line rounded-2xl p-8 transition-all hover:bg-surface/80 hover:border-accent/40 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        {message.category ? (
          <span className="px-3 py-1 bg-accent text-black rounded text-[10px] font-black uppercase tracking-widest">
            {message.category}
          </span>
        ) : (
          <span className="px-3 py-1 bg-white/5 text-text-dim rounded text-[10px] font-black uppercase tracking-widest">
            ANON DROP
          </span>
        )}
        <div className="flex items-center gap-2 text-text-dim/40">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {formatDistanceToNow(message.createdAt.toDate(), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Message text */}
      <p className="text-2xl font-black text-text-main leading-none mb-8">{message.content}</p>

      {/* ── Image attachments ────────────────────────────────────────────────── */}
      {message.imageUrls && message.imageUrls.length > 0 && (
        <div className={`grid gap-2 mb-8 ${
          message.imageUrls.length === 1 ? 'grid-cols-1' :
          message.imageUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
          {message.imageUrls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-bg border border-grid-line">
              <img src={url} alt="Attached" className="w-full h-full object-cover hover:scale-105 transition-transform" />
            </div>
          ))}
        </div>
      )}

      {/* ── Video attachments ────────────────────────────────────────────────── */}
      {message.videoUrls && message.videoUrls.length > 0 && (
        <div className="mb-8 space-y-3">
          {message.videoUrls.map((url, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden bg-bg border border-grid-line group/vid">
              <video
                src={url}
                className="w-full max-h-64 object-contain bg-black"
                controls
                preload="metadata"
              />
              {/* Actions: download (raw) + share via Web Share API */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/vid:opacity-100 transition-all">
                <a
                  href={url}
                  download={`anon-video-${message.id}-${i}.mp4`}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black/90"
                >
                  <Download className="w-3 h-3" />
                  Save
                </a>
                <button
                  onClick={() => handleShareVideo(url)}
                  disabled={sharingVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/80 backdrop-blur-sm text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-accent disabled:opacity-50"
                >
                  <Share2 className="w-3 h-3" />
                  {sharingVideo ? '…' : 'Share'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Audio drop ────────────────────────────────────────────────────────── */}
      {message.audioUrl && (
        <div className="mb-8 space-y-3">
          <AudioPlayer url={message.audioUrl} messageId={message.id} />

          {/* Export as MP4 Video — the game-changer */}
          {profile && (
            <div className="flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-[10px] text-text-dim font-black uppercase tracking-widest">Share as Video:</span>
              <AudioVideoExporter message={message} profile={profile} />
            </div>
          )}
        </div>
      )}

      {/* ── Reaction bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {REACTION_OPTIONS.map(emoji => {
          const count = (message.reactions?.[emoji] as number) || 0;
          return (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              disabled={reacting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg border border-grid-line text-sm hover:border-accent hover:bg-accent/5 transition-all active:scale-95 disabled:opacity-50 group/rx"
            >
              <span>{emoji}</span>
              {count > 0 && (
                <span className="text-[10px] font-black text-text-dim group-hover/rx:text-accent transition-colors">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-grid-line">
        <button
          onClick={() => onShare(message)}
          className="flex items-center gap-2 text-text-dim hover:text-accent transition-colors font-black text-[11px] uppercase tracking-widest"
        >
          <Share2 className="w-4 h-4" />
          Share Drop
        </button>
        <button
          onClick={() => onDelete(message)}
          className="text-text-dim/20 hover:text-red-500 transition-all p-2"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Hover accent bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-accent w-0 group-hover:w-full transition-all duration-300" />
    </div>
  );
};

export default MessageCard;
