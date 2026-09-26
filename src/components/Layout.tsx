import React from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-accent/20 bg-grid">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
