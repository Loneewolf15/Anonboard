import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Ghost, ArrowRight, Check, ImageIcon, Trash2, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import cloudinaryConfig from '../../cloudinary-config.json';

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || cloudinaryConfig.cloudName;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || cloudinaryConfig.uploadPreset;
// Cloudinary auto-upload endpoint — handles both images and videos
const CLOUDINARY_AUTO_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;

const MAX_VIDEO_MB = 50;

export default function SendMessage() {
  const { username } = useParams();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'feedback' | 'question' | 'compliment' | 'general'>('general');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Media state ──────────────────────────────────────────────────────────
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);   // max 1
  const [uploadProgress, setUploadProgress] = useState('');

  const categories = [
    { id: 'general', label: 'General', emoji: '👻' },
    { id: 'feedback', label: 'Feedback', emoji: '📈' },
    { id: 'question', label: 'Question', emoji: '❓' },
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
          if (docSnap.exists()) {
            setRecipient(docSnap.data() as UserProfile);
          } else {
            setError('User not found');
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to fetch user. Ensure the link is correct.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipient();
  }, [username]);

  // ── Image handling ───────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files) as File[];
      if (images.length + selected.length > 3) {
        alert('You can only attach a maximum of 3 images.');
        return;
      }
      const validFiles = selected.filter(f => {
        if (f.size > 5 * 1024 * 1024) { alert(`Image ${f.name} is larger than 5MB.`); return false; }
        return true;
      });
      setImages(prev => [...prev, ...validFiles].slice(0, 3));
    }
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  // ── Video handling ───────────────────────────────────────────────────────
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Video must be under ${MAX_VIDEO_MB}MB.`);
      return;
    }
    setVideos([file]);
  };

  // ── Upload helper: image to Cloudinary ──────────────────────────────────
  const uploadImage = async (file: File, recipientUid: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_PRESET);
    fd.append('folder', `anonboard/${recipientUid}/images`);
    // Preserve dimensions — only compress codec/quality
    fd.append('quality', 'auto:good');
    const res = await fetch(CLOUDINARY_AUTO_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
    const data = await res.json();
    return data.secure_url as string;
  };

  // ── Upload helper: video to Cloudinary ──────────────────────────────────
  const uploadVideo = async (file: File, recipientUid: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_PRESET);
    fd.append('folder', `anonboard/${recipientUid}/videos`);
    // quality=auto:good — reduces bitrate 40-70%, original resolution PRESERVED
    fd.append('quality', 'auto:good');
    const res = await fetch(CLOUDINARY_AUTO_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Video upload failed (${res.status})`);
    const data = await res.json();
    return data.secure_url as string;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !recipient) return;
    setLoading(true);
    try {
      let imageUrls: string[] = [];
      let videoUrls: string[] = [];

      if (images.length > 0) {
        setUploadProgress('Uploading images...');
        imageUrls = await Promise.all(images.map(f => uploadImage(f, recipient.uid)));
      }

      if (videos.length > 0) {
        setUploadProgress('Uploading video...');
        videoUrls = await Promise.all(videos.map(f => uploadVideo(f, recipient.uid)));
      }

      setUploadProgress('Sending drop...');
      await addDoc(collection(db, 'users', recipient.uid, 'messages'), {
        content: content.trim(),
        recipientUid: recipient.uid,
        category,
        ...(imageUrls.length > 0 && { imageUrls }),
        ...(videoUrls.length > 0 && { videoUrls }),
        createdAt: serverTimestamp(),
        reactions: {},
      });
      setSent(true);
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#00FF88', '#FFFFFF', '#141414'] });
    } catch (err) {
      console.error(err);
      setError('Failed to send message. Attachments might be too large or the server rejected it.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  // ── Loading / error states ───────────────────────────────────────────────
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
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 text-white">404 - Nobody here</h2>
        <p className="text-text-dim text-sm max-w-sm mb-8">{error}</p>
        <Link to="/" className="px-6 py-3 bg-surface border border-grid-line text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95">
          Return Home
        </Link>
      </div>
    );
  }

  const hasImages = images.length > 0;
  const hasVideo = videos.length > 0;

  return (
    <div className="max-w-xl mx-auto px-6 sm:px-10 py-12 sm:py-20">
      {/* Header */}
      <div className="text-center mb-12 sm:mb-16 space-y-4 sm:space-y-6">
        <div className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-accent mb-4">CONFESSIONAL</div>
        <div className="relative inline-block">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-surface border border-grid-line p-1 rounded-3xl mb-4 sm:mb-6 mx-auto overflow-hidden">
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
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic mb-2 leading-tight">
          Send to {recipient?.displayName}
        </h2>
        <p className="text-text-dim font-bold uppercase text-[11px] sm:text-[13px] tracking-tight">Zero traces left behind.</p>
      </div>

      {/* Category Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id as any)}
            className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border transition-all ${
              category === cat.id ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-grid-line text-text-dim hover:border-white/20'
            }`}
          >
            <span className="text-lg sm:text-xl">{cat.emoji}</span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* Message textarea */}
        <div className="relative group">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
            placeholder="TYPE YOUR MESSAGE..."
            className="w-full h-48 sm:h-56 bg-surface border border-grid-line rounded-2xl p-6 sm:p-10 text-xl sm:text-2xl font-bold text-white placeholder:text-white/5 focus:outline-none focus:border-accent transition-all resize-none shadow-2xl"
            maxLength={1000}
            required
          />
          <div className="absolute bottom-4 right-6 sm:bottom-6 sm:right-10 text-[9px] sm:text-[10px] font-black tracking-[0.2em] text-text-dim uppercase">
            {content.length}/1000
          </div>
        </div>

        {/* Image previews */}
        {hasImages && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {images.map((file, i) => (
              <div key={i} className="relative aspect-square rounded-xl bg-bg border border-grid-line overflow-hidden group/img">
                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video preview */}
        {hasVideo && (
          <div className="relative rounded-2xl bg-bg border border-grid-line overflow-hidden">
            <video
              src={URL.createObjectURL(videos[0])}
              className="w-full max-h-52 object-contain"
              controls
              muted
            />
            <button
              type="button"
              onClick={() => setVideos([])}
              className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-xl text-white backdrop-blur-sm hover:bg-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
              {videos[0].name} · {(videos[0].size / (1024 * 1024)).toFixed(1)}MB
            </div>
          </div>
        )}

        {/* Media buttons + Submit */}
        <div className="flex gap-3 sm:gap-4">
          {/* Image attach — hidden when video selected */}
          {!hasVideo && (
            <label className={`w-14 sm:w-16 shrink-0 flex items-center justify-center border rounded-xl cursor-pointer transition-all ${
              hasImages && images.length >= 3 || loading
                ? 'bg-transparent border-grid-line/50 text-white/10'
                : 'bg-surface border-grid-line text-text-dim hover:text-white hover:border-white/20'
            }`}>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
                disabled={images.length >= 3 || loading}
              />
              <ImageIcon className="w-5 h-5" />
            </label>
          )}

          {/* Video attach — hidden when images selected */}
          {!hasImages && (
            <label className={`w-14 sm:w-16 shrink-0 flex items-center justify-center border rounded-xl cursor-pointer transition-all ${
              hasVideo || loading
                ? 'bg-transparent border-grid-line/50 text-white/10'
                : 'bg-surface border-grid-line text-text-dim hover:text-white hover:border-white/20'
            }`}>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoChange}
                disabled={hasVideo || loading}
              />
              <Video className="w-5 h-5" />
            </label>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex-1 flex items-center justify-center gap-3 py-4 sm:py-6 bg-accent text-black rounded-xl font-black text-lg sm:text-2xl uppercase italic tracking-tighter transition-all active:scale-95 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            {loading ? (uploadProgress || 'SENDING...') : (
              <>
                DROP ANONYMOUSLY
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success modal */}
      <AnimatePresence>
        {sent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              <p className="text-text-dim mb-8 uppercase font-black tracking-widest text-xs">Anonymous drop complete for {recipient?.displayName}.</p>

              <div className="flex flex-col gap-3">
                <Link
                  to="/"
                  className="w-full py-4 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:bg-neutral-200 active:scale-95"
                >
                  Create Your Own Board
                </Link>
                <button
                  onClick={() => { setSent(false); setContent(''); setImages([]); setVideos([]); }}
                  className="w-full py-4 bg-transparent border border-grid-line text-text-dim rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95"
                >
                  Send Another Message
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
