import React, { useState } from 'react';
import { Message } from '../types';
import { Share2, Clock, Trash2, Download } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';

interface MessageCardProps {
  message: Message;
  onShare: (message: Message) => void;
  onDelete: (message: Message) => void | Promise<void>;
}

// ─── Reaction picker config ──────────────────────────────────────────────────
const REACTION_OPTIONS = ['🔥', '😂', '💀', '❤️', '👀', '💯'];

const MessageCard: React.FC<MessageCardProps> = ({ message, onShare, onDelete }) => {
  const [reacting, setReacting] = useState(false);

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

  return (
    <div className="group relative bg-surface border border-grid-line rounded-2xl p-8 transition-all hover:bg-surface/80 hover:border-accent/40 shadow-xl overflow-hidden">
      {/* Header row */}
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

      {/* Message content */}
      <p className="text-2xl font-black text-text-main leading-none mb-8">{message.content}</p>

      {/* Image attachments */}
      {message.imageUrls && message.imageUrls.length > 0 && (
        <div className={`grid gap-2 mb-8 ${
          message.imageUrls.length === 1 ? 'grid-cols-1' :
          message.imageUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
          {message.imageUrls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-bg border border-grid-line">
              <img src={url} alt="Attached drop" className="w-full h-full object-cover transition-transform hover:scale-105" />
            </div>
          ))}
        </div>
      )}

      {/* ── Video attachments (TASK-04) ───────────────────────────────────── */}
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
              {/* Download button — appears on hover */}
              <a
                href={url}
                download={`anon-video-${message.id}-${i}.mp4`}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/vid:opacity-100 transition-all hover:bg-black/90"
              >
                <Download className="w-3 h-3" />
                Save
              </a>
            </div>
          ))}
        </div>
      )}

      {/* ── Reaction bar (TASK-05) ────────────────────────────────────────── */}
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

      {/* Footer actions */}
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

      {/* Decorative hover accent line */}
      <div className="absolute bottom-0 left-0 h-1 bg-accent w-0 group-hover:w-full transition-all duration-300" />
    </div>
  );
};

export default MessageCard;
