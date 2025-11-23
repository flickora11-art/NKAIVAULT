
import React, { useRef, useState, useEffect } from "react";

export default function NKAIVaultApp() {
  const [user, setUser] = useState(null); // stub auth
  const [prompt, setPrompt] = useState("Cinematic sunlit stadium, epic lights");
  const [fps, setFps] = useState(30);
  const [aspect, setAspect] = useState("16:9"); // "16:9", "9:16", "1:1"
  const [format, setFormat] = useState("webm"); // webm or mp4 (mp4 requires server)
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const canvasRef = useRef(null);
  const chunksRef = useRef([]);
  const galleryKey = "nkaivault_gallery_v1";

  const ASPECTS = {
    "16:9": { w: 1920, h: 1080 },
    "9:16": { w: 1080, h: 1920 },
    "1:1": { w: 1080, h: 1080 }
  };
  const DURATION_MS = 5000;

  useEffect(() => {
    // load gallery presence (we keep code simple; gallery UI exists in minimal form)
  }, []);

  function signIn(provider) {
    setUser({ id: provider + "_user", name: provider === "google" ? "Google User" : "Apple User" });
  }
  function signOut() { setUser(null); }

  function drawFrame(ctx, t, frameIdx, W, H) {
    // simple animated background + title
    const hue = Math.floor((t * 120) % 360);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${hue}, 70%, 20%)`);
    g.addColorStop(1, `hsl(${(hue + 60) % 360}, 60%, 30%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // floating lights
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const px = W * (0.2 + 0.6 * Math.sin(frameIdx * 0.02 + i));
      const py = H * (0.3 + 0.4 * Math.cos(frameIdx * 0.015 + i));
      const r = Math.min(W, H) * (0.06 + Math.abs(Math.sin(frameIdx * 0.01 + i)) * 0.08);
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, "rgba(255,255,255,0.12)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // text
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(Math.min(W/14, 64))}px Inter, system-ui`;
    ctx.fillText("NKAIVault", W/2, H*0.18 + Math.sin(t*Math.PI*2)*8);
    ctx.font = `${Math.round(Math.min(W/36, 28))}px Inter, system-ui`;
    wrapText(ctx, prompt, W/2, H*0.56, W*0.78, Math.round(Math.min(W/26, 40)));
    ctx.restore();

    if (!user) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.font = `${Math.round(Math.min(W/30, 42))}px Inter`;
      ctx.fillStyle = "black";
      ctx.translate(W*0.05, H*0.88);
      ctx.rotate(-0.25);
      ctx.fillText("NKAIVault • Preview", 0, 0);
      ctx.restore();
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = "";
    let ty = y;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, ty);
        line = words[n] + " ";
        ty += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, ty);
  }

  async function generateClip() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const spec = ASPECTS[aspect];
    canvas.width = spec.w;
    canvas.height = spec.h;
    const ctx = canvas.getContext("2d", { alpha: false });
    setIsGenerating(true);
    chunksRef.current = [];

    const stream = canvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
      ? 'video/webm; codecs=vp9'
      : 'video/webm';
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (e) {
      alert("MediaRecorder not supported. Use Chrome/Edge/Firefox on desktop.");
      setIsGenerating(false);
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    recorder.start(100);

    const start = performance.now();
    let frame = 0;
    function step(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / DURATION_MS, 1);
      drawFrame(ctx, t, frame, spec.w, spec.h);
      frame++;
      if (elapsed < DURATION_MS) requestAnimationFrame(step);
      else setTimeout(()=> recorder.stop(), 60);
    }
    requestAnimationFrame(step);

    await new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        // save to gallery (basic localStorage pointer)
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const g = JSON.parse(localStorage.getItem(galleryKey) || "[]");
            g.unshift({ id: Date.now(), name: prompt.slice(0,40)||'clip', dataUrl, date: new Date().toISOString(), aspect, signed: !!user });
            localStorage.setItem(galleryKey, JSON.stringify(g.slice(0,50)));
          };
          reader.readAsDataURL(blob);
        } catch (e) { console.warn(e); }
        resolve();
      };
    });

    setIsGenerating(false);
  }

  function downloadCurrent() {
    if (!videoUrl) { alert("No clip to download"); return; }
    if (!user) { alert("Sign in to download (free)."); return; }
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `NKAIVault_${Date.now()}.webm`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-6">
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-xl flex items-center justify-center font-bold">N</div>
          <div>
            <h1 className="text-2xl font-bold">NKAIVault</h1>
            <div className="text-sm text-slate-300">Free • Unlimited • 5s clips</div>
          </div>
        </div>
        <div>
          {user ? (<div className="flex items-center gap-2"><span className="text-sm">Hi, {user.name}</span><button className="ml-3 px-3 py-1 bg-slate-800 rounded" onClick={signOut}>Sign out</button></div>) : (<div className="flex gap-2"><button className="px-3 py-1 bg-white text-black rounded" onClick={()=>signIn('google')}>Sign in Google</button><button className="px-3 py-1 bg-black text-white rounded" onClick={()=>signIn('apple')}>Sign in Apple</button></div>)}
        </div>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-12 gap-6">
        <section className="col-span-4 bg-slate-800/40 p-4 rounded">
          <h2 className="font-semibold mb-2">Create</h2>
          <label className="text-sm">Aspect</label>
          <select value={aspect} onChange={(e)=>setAspect(e.target.value)} className="w-full p-2 mt-1 rounded bg-slate-900">
            <option value="16:9">16:9 (landscape)</option>
            <option value="9:16">9:16 (portrait - Shorts)</option>
            <option value="1:1">1:1 (square)</option>
          </select>

          <label className="text-sm mt-3">Prompt</label>
          <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} className="w-full p-2 mt-1 rounded bg-slate-900" rows={3} />

          <label className="text-sm mt-3">FPS</label>
          <input type="number" value={fps} onChange={(e)=>setFps(Math.max(12,Math.min(60,Number(e.target.value)||30)))} className="w-full p-2 mt-1 rounded bg-slate-900" />

          <div className="mt-4 flex gap-2">
            <button onClick={generateClip} disabled={isGenerating} className={`flex-1 p-3 rounded ${isGenerating?'bg-slate-600':'bg-emerald-500'}`}>{isGenerating?'Generating...':'Generate 5s'}</button>
            <button onClick={()=>{ setPrompt(''); setFps(30); }} className="p-3 rounded bg-slate-700">Reset</button>
          </div>

          <div className="mt-3 text-xs text-slate-300">Note: Downloads are WebM client-side. For MP4, use server conversion (I will give server files).</div>
        </section>

        <section className="col-span-8 bg-slate-800/30 p-4 rounded">
          <h3 className="font-semibold mb-2">Preview</h3>
          <div className="bg-black rounded aspect-video overflow-hidden flex items-center justify-center" style={{aspectRatio: aspect==="16:9"? "16/9": aspect==="9:16"? "9/16":"1/1"}}>
            <canvas ref={canvasRef} className="hidden" />
            {videoUrl ? <video src={videoUrl} controls className="w-full h-full object-cover" /> : <div className="text-slate-400">No clip yet</div>}
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={downloadCurrent} className="px-3 py-2 bg-indigo-600 rounded">Download</button>
            <button onClick={()=>{ if(videoUrl){ URL.revokeObjectURL(videoUrl); setVideoUrl(null); } }} className="px-3 py-2 bg-slate-700 rounded">Clear</button>
            <div className="ml-auto text-sm text-slate-300">Press G to quick generate.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
