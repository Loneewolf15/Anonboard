import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, onSnapshot, orderBy, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, Message } from '../types';
import { Ghost, ExternalLink, Copy, Check, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MessageCard from '../components/MessageCard';
import ShareCard from '../components/ShareCard';
import WatermarkSettings from '../components/WatermarkSettings';

// -- Subcomponents --
function AnimalAvatarPicker({ onSelect, selectedUrl }: { onSelect: (url: string) => void, selectedUrl: string }) {
  const animals = ['lion', 'panda', 'fox', 'rabbit', 'owl', 'koala', 'penguin', 'bear'];
  const getUrl = (seed: string) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;

  return (
    <div className="grid grid-cols-4 gap-3">
      {animals.map(animal => {
        const url = getUrl(animal);
        return (
          <button
            key={animal}
            type="button"
            onClick={() => onSelect(url)}
            className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${
              selectedUrl === url ? 'border-accent scale-105 shadow-[0_0_15px_rgba(0,255,136,0.3)]' : 'border-grid-line hover:border-white/20'
            }`}
          >
            <img src={url} alt={animal} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            {selectedUrl === url && (
              <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-black" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProfileEditor({ profile, onUpdate }: { profile: UserProfile, onUpdate: (p: UserProfile) => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(!profile.username); // open automatically if no username

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = { ...profile, displayName, username, avatarUrl };
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        username,
        avatarUrl
      });
      onUpdate(updated);
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border border-grid-line text-text-dim rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5"
      >
        <Edit2 className="w-3 h-3" />
        Edit Profile
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-bg/95 backdrop-blur-xl z-[60] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-surface border border-grid-line rounded-3xl p-6 sm:p-10 shadow-2xl my-auto"
            >
              <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter mb-8">Edit Profile</h2>
              
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Display Name</label>
                  <input 
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-bg border border-grid-line rounded-xl px-4 py-4 text-xs text-white focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Claim Vanity Username (e.g. yourname)</label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-bg border border-grid-line rounded-xl px-4 py-4 text-xs text-white focus:outline-none focus:border-accent"
                    required
                    pattern="^[a-zA-Z0-9_]+$"
                    title="Alphanumeric and underscores only"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Choose Your Animal Avatar</label>
                  <AnimalAvatarPicker 
                    selectedUrl={avatarUrl}
                    onSelect={setAvatarUrl}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-dim block mb-3">Or Avatar URL</label>
                  <input 
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-bg border border-grid-line rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  {profile.username && (
                    <button 
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 py-4 bg-surface border border-grid-line text-text-dim rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={loading || !username}
                    className="flex-1 py-4 bg-accent text-black rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// -- Main Component --
export default function Dashboard({ user }: { user: User }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sharingMessage, setSharingMessage] = useState<Message | null>(null);
  const [copyLinkNotif, setCopyLinkNotif] = useState(false);

  const filters = [
    { id: 'all', label: 'All', emoji: '📂' },
    { id: 'feedback', label: 'Feedback', emoji: '📈' },
    { id: 'question', label: 'Question', emoji: '❓' },
    { id: 'compliment', label: 'Compliment', emoji: '✨' },
    { id: 'general', label: 'General', emoji: '👻' },
  ];

  useEffect(() => {
    // Get/Create Profile
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          // Send ABSOLUTE bare minimum fields required by database rules
          const newProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Anonymous User',
            createdAt: serverTimestamp(),
          };
          await setDoc(docRef, newProfile);
          setProfile({ ...newProfile, createdAt: Timestamp.now() } as any);
        } else {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (err: any) {
        console.error("Profile initialization failed:", err);
        if (err.message.toLowerCase().includes('permission')) {
            alert("Database Permission Error. Your anonymous session might be invalid or corrupt. We are refreshing your session.");
            auth.signOut();
        } else {
            alert("Database Error: " + err.message);
        }
      }
    };
    
    fetchProfile();

    let q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const filteredMessages = activeFilter === 'all' 
    ? messages 
    : messages.filter(m => m.category === activeFilter);

  const handleDelete = async (msg: Message) => {
    if (confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'messages', msg.id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const shareLink = `${window.location.origin}/${profile?.username || user.uid}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopyLinkNotif(true);
    setTimeout(() => setCopyLinkNotif(false), 2000);
  };

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 sm:gap-10 p-4 sm:p-10 min-h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className="space-y-6 sm:space-y-8 flex flex-col">
        <section className="bg-surface border border-grid-line p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col gap-6">
           <div className="flex items-center gap-4 mb-2">
             <div className="w-16 h-16 bg-bg border border-grid-line rounded-2xl flex items-center justify-center overflow-hidden">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Ghost className="w-8 h-8 text-white/20" />
                )}
             </div>
             <div>
               <h2 className="text-xl font-black tracking-tight leading-none mb-1">{profile?.displayName}</h2>
               <p className="text-[10px] font-black uppercase tracking-widest text-accent">Active Board</p>
             </div>
           </div>

           {profile && <ProfileEditor profile={profile} onUpdate={setProfile} />}

           <div>
             <h2 className="text-xs font-black uppercase tracking-widest text-text-dim mb-4">Sharing Center</h2>
             <p className="text-sm text-text-dim leading-relaxed mb-6 font-medium">
               Broadcast your link to receive new messages from your circle.
             </p>
           </div>
           
           <div className="space-y-4">
             <div className="bg-bg border border-grid-line rounded-xl p-4 flex flex-col gap-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-accent/60">Your Board Link</span>
               <div className="flex items-center gap-3 overflow-hidden">
                 <input 
                   readOnly 
                   value={shareLink} 
                   className="bg-transparent text-xs font-mono text-white w-full outline-none truncate" 
                 />
                 <button 
                   onClick={copyLink}
                   className="p-2 transition-all hover:text-accent"
                 >
                   {copyLinkNotif ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                 </button>
               </div>
             </div>
             
             <button 
               onClick={() => window.open(shareLink, '_blank')}
               className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-neutral-200 active:scale-95"
             >
               <ExternalLink className="w-4 h-4" />
               View Live Board
             </button>
           </div>
        </section>

        {profile && <WatermarkSettings user={profile} />}
        
        <div className="flex-1" />
        
        <div className="text-[10px] text-text-dim font-black uppercase tracking-widest text-center border-t border-grid-line pt-8 opacity-40">
           PROMOTED CONTENT · ADSPACE_ALPHA
        </div>
      </div>

      {/* Main Inbox */}
      <div className="flex flex-col bg-surface/50 border border-grid-line rounded-3xl p-6 sm:p-10 shadow-2xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-10 border-b border-grid-line">
          <div>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic">
              Inbox <span className="text-accent underline decoration-4 underline-offset-8">{messages.length}</span>
            </h3>
            <p className="text-text-dim text-[10px] sm:text-xs font-black uppercase tracking-widest mt-2">{filteredMessages.length} visible with current filter</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  activeFilter === f.id 
                    ? 'bg-accent border-accent text-black' 
                    : 'bg-surface border-grid-line text-text-dim hover:border-white/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {filteredMessages.length === 0 ? (
             <div className="col-span-full py-40 text-center border border-dashed border-grid-line rounded-3xl bg-bg/20">
                <Ghost className="w-16 h-16 text-text-dim/10 mx-auto mb-6" />
                <p className="text-text-dim font-black uppercase tracking-widest text-sm italic">
                  {activeFilter === 'all' ? 'Nothing but echoes...' : `No ${activeFilter} messages yet.`}
                </p>
             </div>
          ) : (
            filteredMessages.map(msg => (
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onShare={setSharingMessage}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal remains relative to full viewport */}
      <AnimatePresence>
        {sharingMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSharingMessage(null)}
               className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative z-10 w-full max-w-lg"
            >
              <ShareCard 
                message={sharingMessage} 
                profile={profile || undefined} 
              />
              <button 
                onClick={() => setSharingMessage(null)}
                className="absolute -top-12 right-0 p-2 text-white/40 hover:text-white transition-colors"
              >
                Close (ESC)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
