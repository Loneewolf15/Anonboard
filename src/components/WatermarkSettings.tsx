import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Check, Edit2, X } from 'lucide-react';

interface WatermarkSettingsProps {
  user: UserProfile;
}

export default function WatermarkSettings({ user }: WatermarkSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(user.watermark || 'ANONBOARD · GLOBAL');
  const [font, setFont] = useState(user.watermarkFont || 'sans-serif');
  const [color, setColor] = useState(user.watermarkColor || '#444444');
  const [position, setPosition] = useState(user.watermarkPosition || 'bottom');
  const [loading, setLoading] = useState(false);

  const fonts = ['sans-serif', 'serif', 'monospace', 'cursive'];
  const positions = ['top', 'center', 'bottom'];
  const colors = ['#444444', '#00FF88', '#FFFFFF', '#FF4444', '#4444FF'];

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        watermark: val,
        watermarkFont: font,
        watermarkColor: color,
        watermarkPosition: position
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-grid-line rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-text-dim">Preview Customization</h3>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="p-2 text-text-dim hover:text-accent transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={handleSave}
              disabled={loading}
              className="p-2 text-accent disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-2">Display Text</label>
          <input 
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            disabled={!isEditing}
            className="w-full bg-bg border border-grid-line rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent transition-colors font-medium"
            placeholder="e.g. YOUR WATERMARK"
            maxLength={100}
          />
        </div>

        {isEditing && (
          <div className="grid grid-cols-1 gap-6 pt-4 border-t border-grid-line">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Font Style</label>
              <div className="flex flex-wrap gap-2">
                {fonts.map(f => (
                  <button
                    key={f}
                    onClick={() => setFont(f)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      font === f ? 'bg-accent text-black' : 'bg-bg text-text-dim border border-grid-line'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Position</label>
              <div className="flex gap-2">
                {positions.map(p => (
                  <button
                    key={p}
                    onClick={() => setPosition(p as any)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      position === p ? 'bg-accent text-black' : 'bg-bg text-text-dim border border-grid-line'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Text Color</label>
              <div className="flex gap-3">
                {colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      color === c ? 'border-accent scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-black/50 rounded-xl border border-white/5">
           <p className="text-[9px] text-text-dim/40 font-black uppercase tracking-widest leading-none mb-1">Live Preview</p>
           <p className="text-[10px] tracking-widest truncate" style={{ fontFamily: font, color: color }}>
             👻 ANONBOARD · {val.toUpperCase()}
           </p>
        </div>
      </div>
    </div>
  );
}
