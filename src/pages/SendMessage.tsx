import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Ghost, ArrowRight, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

export default function SendMessage() {
  const { username } = useParams(); // Now this acts as either username OR uid in fallback mode
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'feedback' | 'question' | 'compliment' | 'general'>('general');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = [
    { id: 'general', label: 'General', emoji: '👻' },
    { id: 'feedback', label: 'Feedback', emoji: '📈' },
    { id: 'question', label: 'Question', emoji: '❓' },
    { id: 'compliment', label: 'Compliment', emoji: '✨' },
  ];

  useEffect(() => {
    const fetchRecipient = async () => {
      if (!username) {
        setError('No user specified');
        setLoading(false);
        return;
      }
      
      try {
        // Direct UID lookup bypasses the need for complex Firestore 'list' rules
        const docSnap = await getDoc(doc(db, 'users', username));
        if (docSnap.exists()) {
          setRecipient(docSnap.data() as UserProfile);
        } else {
          setError('User not found');
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError('Failed to fetch user. Ensure the link is correct.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipient();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !recipient) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', recipient.uid, 'messages'), {
        content: content.trim(),
        recipientUid: recipient.uid,
        category,
        createdAt: serverTimestamp(),
        reactions: {},
      });
      setSent(true);
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#00FF88', '#FFFFFF', '#141414']
      });
    } catch (err) {
      console.error(err);
      setError('Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

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
        <Link 
          to="/" 
          className="px-6 py-3 bg-surface border border-grid-line text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95"
        >
          Return Home
        </Link>
      </div>
    );
  }



  return (
    <div className="max-w-xl mx-auto px-6 sm:px-10 py-12 sm:py-20">
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
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic mb-2 leading-tight">Send to {recipient?.displayName}</h2>
        <p className="text-text-dim font-bold uppercase text-[11px] sm:text-[13px] tracking-tight">Zero traces left behind.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id as any)}
            className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border transition-all ${
              category === cat.id 
                ? 'bg-accent/10 border-accent text-accent' 
                : 'bg-surface border-grid-line text-text-dim hover:border-white/20'
            }`}
          >
            <span className="text-lg sm:text-xl">{cat.emoji}</span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
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

        <button 
          type="submit"
          disabled={loading || !content.trim()}
          className="w-full flex items-center justify-center gap-3 py-4 sm:py-6 bg-accent text-black rounded-xl font-black text-lg sm:text-2xl uppercase italic tracking-tighter transition-all active:scale-95 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)]"
        >
          {loading ? 'SENDING...' : (
            <>
              DROP ANONYMOUSLY
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
            </>
          )}
        </button>
      </form>

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
                  onClick={() => { setSent(false); setContent(''); }}
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
