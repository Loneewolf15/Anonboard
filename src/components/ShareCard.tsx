import React, { useRef, useEffect } from 'react';
import { Message, UserProfile } from '../types';
import { Download, Copy, Check, Ghost } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareCardProps {
  message: Message;
  profile?: UserProfile;
}

export default function ShareCard({ message, profile }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = React.useState(false);

  const generateCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution
    const scale = 2;
    canvas.width = 1080;
    canvas.height = 1080;
    ctx.scale(scale, scale);
    const w = 540;
    const h = 540;

    // Background - Solid Black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Grid Texture
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Category Badge
    const badgeText = (message.category || 'ANON DROP').toUpperCase();
    ctx.font = '900 10px sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeWidth = textWidth + 24;
    ctx.fillStyle = '#00FF88'; // Accent color
    ctx.beginPath();
    ctx.roundRect(40, 40, badgeWidth, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, 40 + badgeWidth / 2, 56);

    // Message Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'left';
    
    // Wrapped Text
    const words = message.content.split(' ');
    let line = '';
    const lines = [];
    const maxWidth = 460;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    lines.forEach((l, i) => {
      ctx.fillText(l.trim(), 40, 120 + i * 42);
    });

    const textEndY = 120 + lines.length * 42;

    // Draw actual attached images in a grid on the canvas
    if (message.imageUrls && message.imageUrls.length > 0) {
      const urls = message.imageUrls.slice(0, 3);
      const count = urls.length;
      const imageAreaY = textEndY + 20;
      const padding = 8;
      const totalWidth = w - 80; // 40px left + 40px right margin
      const imgW = count === 1 ? totalWidth : count === 2 ? (totalWidth - padding) / 2 : (totalWidth - padding * 2) / 3;
      const imgH = imgW; // square thumbnails

      // Load all images first, then draw
      const loadedImages = await Promise.all(
        urls.map((url) => new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        }))
      );

      loadedImages.forEach((img, i) => {
        const xPos = 40 + i * (imgW + padding);
        // clip to rounded rect
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(xPos, imageAreaY, imgW, imgH, 8);
        ctx.clip();

        // cover-fit the image
        const aspect = img.naturalWidth / img.naturalHeight;
        let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (aspect > 1) { sw = img.naturalHeight; sx = (img.naturalWidth - sw) / 2; }
        else { sh = img.naturalWidth; sy = (img.naturalHeight - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, xPos, imageAreaY, imgW, imgH);
        ctx.restore();
      });
    }

    // Reaction Counts
    const reactions = Object.entries(message.reactions || {});
    if (reactions.length > 0) {
      ctx.font = '16px sans-serif';
      let rxPos = 40;
      reactions.forEach(([emoji, count]) => {
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(rxPos, 400, 40, 32, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${emoji} ${count}`, rxPos + 8, 421);
        rxPos += 60;
      });
    }

    // Watermark
    const wmText = profile?.watermark || 'ANONBOARD · GLOBAL';
    const wmFont = profile?.watermarkFont || 'monospace';
    const wmColor = profile?.watermarkColor || '#444444';
    const wmPos = profile?.watermarkPosition || 'bottom';

    ctx.fillStyle = wmColor;
    ctx.font = `800 10px ${wmFont}`;
    ctx.textAlign = 'center';
    const watermarkText = `👻 ANONBOARD · ${wmText.toUpperCase()}`;
    
    let yPos = h - 30;
    if (wmPos === 'top') yPos = 30;
    if (wmPos === 'center') yPos = h / 2 + (lines.length * 42) / 2 + 80;

    ctx.fillText(watermarkText, w / 2, yPos);
  };

  useEffect(() => {
    generateCanvas().catch(console.error);
  }, [message, profile]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `anon-message-${message.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      });
    } catch (err) {
      console.error('Failed to copy image', err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4 bg-neutral-900 rounded-3xl border border-white/10 max-w-lg w-full">
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full"
        />
      </div>
      
      <div className="flex gap-3 w-full">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white text-black rounded-xl font-medium transition-transform active:scale-95 hover:bg-neutral-200"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center justify-center p-3 bg-neutral-800 text-white rounded-xl transition-transform active:scale-95 hover:bg-neutral-700"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
