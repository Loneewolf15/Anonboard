import React from 'react';
import { Message } from '../types';
import { Share2, Clock, Trash2, Heart, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessageCardProps {
  message: Message;
  onShare: (message: Message) => void;
  onDelete: (message: Message) => void | Promise<void>;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, onShare, onDelete }) => {
  return (
    <div className="group relative bg-surface border border-grid-line rounded-2xl p-8 transition-all hover:bg-surface/80 hover:border-accent/40 shadow-xl overflow-hidden">
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

      <p className="text-2xl font-black text-text-main leading-none mb-8">
        {message.content}
      </p>

      <div className="flex items-center justify-between mt-auto pt-6 border-t border-grid-line">
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
      
      {/* Decorative hover line */}
      <div className="absolute bottom-0 left-0 h-1 bg-accent w-0 group-hover:w-full transition-all duration-300" />
    </div>
  );
}

export default MessageCard;
