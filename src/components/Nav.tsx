import React from 'react';
import { Link } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut, Settings } from 'lucide-react';

export default function Nav({ user }: { user: User | null }) {
  return (
    <nav className="flex flex-col sm:flex-row items-center justify-between py-4 sm:py-6 px-6 sm:px-10 border-b border-grid-line bg-bg/80 backdrop-blur-md sticky top-0 z-50 gap-4 sm:gap-0">
      <Link to="/" className="flex items-center gap-2 group">
        <span className="text-xl sm:text-2xl font-black tracking-tighter">
          👻 ANON<span className="text-accent underline decoration-2 underline-offset-4">BOARD</span>
        </span>
      </Link>
      
      {user ? (
        <div className="flex items-center gap-6 sm:gap-8 uppercase text-[12px] sm:text-[14px] font-black tracking-widest leading-none">
          <Link 
            to="/dashboard" 
            className="text-accent hover:opacity-80 transition-all flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Dashboard
          </Link>
          <button 
            onClick={() => signOut(auth)}
            className="text-text-dim hover:text-red-400 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      ) : (
        <div className="flex gap-4 uppercase text-[10px] sm:text-[12px] font-black tracking-widest text-text-dim/60">
           <span>The Anonymous Social Board</span>
        </div>
      )}
    </nav>
  );
}
