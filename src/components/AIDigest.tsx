import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Message } from '../types';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIDigestProps {
  messages: Message[];
  onClose: () => void;
}

const SECTIONS = ['VIBE', 'TOP THEMES', 'QUESTIONS FOR YOU'] as const;

export default function AIDigest({ messages, onClose }: AIDigestProps) {
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const generate = async () => {
    if (!apiKey) {
      setError('AI Digest requires a Gemini API key. Add VITE_GEMINI_API_KEY to your .env file.');
      return;
    }
    if (messages.length === 0) return;

    setLoading(true);
    setError('');
    try {
      const ai = new GoogleGenAI({ apiKey });
      const sample = messages.slice(0, 50);
      const contents = sample
        .map(m => `[${m.category || 'general'}] ${m.content}`)
        .join('\n');

      const prompt = `You are analyzing anonymous messages sent to someone's board. Here are the drops:\n\n${contents}\n\nProvide a sharp, honest analysis in exactly this format:\n\nVIBE:\n(2 sentences describing the overall energy and emotional tone — be direct, not generic)\n\nTOP THEMES:\n• (recurring topic 1)\n• (recurring topic 2)\n• (recurring topic 3)\n\nQUESTIONS FOR YOU:\n• (most interesting question people are asking)\n• (second most interesting)\n• (third most interesting)\n\nDon't pad. Be real. If the drops are wild, say so.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      setDigest(response.text ?? 'No insights generated.');
    } catch (err: any) {
      console.error('AI Digest error:', err);
      setError(err.message || 'Failed to generate digest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on first open
  React.useEffect(() => {
    generate();
  }, []);

  /** Parses the "SECTION:\ncontent" format into structured blocks */
  const parseDigest = (raw: string) => {
    const result: { title: string; body: string }[] = [];
    for (const section of SECTIONS) {
      const regex = new RegExp(`${section}:\\s*([\\s\\S]*?)(?=\\n(?:${SECTIONS.join('|')}):|$)`, 'i');
      const match = raw.match(regex);
      if (match) result.push({ title: section, body: match[1].trim() });
    }
    return result.length > 0 ? result : [{ title: 'ANALYSIS', body: raw }];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative z-10 w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/20 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-accent">AI Digest</h2>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{messages.length} drops analysed</p>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-text-dim text-xs font-black uppercase tracking-widest">Reading your drops...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs font-bold leading-relaxed">{error}</p>
          </div>
        )}

        {digest && !loading && !error && (
          <AnimatePresence>
            <div className="space-y-6">
              {parseDigest(digest).map(({ title, body }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="bg-white/3 border border-white/8 rounded-2xl p-5"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-3">{title}</p>
                  <p className="text-white/80 text-sm leading-relaxed font-medium whitespace-pre-line">{body}</p>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Regenerate */}
        {!loading && (
          <button
            onClick={generate}
            className="mt-8 w-full py-3 bg-white/5 border border-white/10 text-white/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            Regenerate
          </button>
        )}

        <p className="text-center text-[9px] text-white/15 mt-4 font-black uppercase tracking-widest">
          Powered by Gemini · Message content is not stored externally
        </p>
      </motion.div>
    </div>
  );
}
