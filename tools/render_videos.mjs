// Rendert die kurzen News-Clips aus den eigenen SVG-Illustrationen (Kamerafahrt, Licht, Logo) Bild für Bild.
// Aufruf: node tools/render_videos.mjs [Zielordner]   (braucht Playwright und ffmpeg; Standard: assets/video)
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const OUT = process.argv[2] || `${ROOT}/assets/video`;
const FPS = 30, SECONDS = 8, W = 1280, H = 720;
const clips = [
  { name: 'rheinstrecke', img: 'route-rhine.svg', from: 'scale(1.02) translate(1.5%, 1%)', to: 'scale(1.16) translate(-3%, -1.5%)', tint: 'none', glow: '#FFD08A' },
  { name: 'nachtfahrt', img: 'route-city.svg', from: 'scale(1.12) translate(-2%, 0)', to: 'scale(1.02) translate(2%, 0)', tint: 'brightness(.42) saturate(1.25) hue-rotate(-12deg)', glow: '#7FB2FF', night: true },
  { name: 'alpen-rallye', img: 'route-alps.svg', from: 'scale(1.04) translate(0, 2%)', to: 'scale(1.18) translate(2.5%, -2%)', tint: 'none', glow: '#FFFFFF' },
];
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const c of clips) {
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const dur = SECONDS * 1000;
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
    .bg{position:absolute;inset:0;background:url('file://${ROOT}/assets/img/${c.img}') center/cover;filter:${c.tint};animation:cam ${dur}ms linear forwards}
    @keyframes cam{from{transform:${c.from}}to{transform:${c.to}}}
    .sweep{position:absolute;inset:-20%;background:linear-gradient(105deg,transparent 40%,${c.glow}33 50%,transparent 60%);animation:sweep ${dur}ms ease-in-out forwards;mix-blend-mode:screen}
    @keyframes sweep{from{transform:translateX(-60%)}to{transform:translateX(60%)}}
    .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)}
    .lights{position:absolute;inset:0;display:${c.night ? 'block' : 'none'}}
    .lights i{position:absolute;width:6px;height:6px;border-radius:50%;background:#FFE7A3;box-shadow:0 0 14px 6px #FFC85A88;animation:blink 1.6s ease-in-out infinite alternate}
    @keyframes blink{from{opacity:.35}to{opacity:1}}
    .logo{position:absolute;left:48px;bottom:40px;width:96px;opacity:0;animation:logo ${dur}ms ease forwards}
    @keyframes logo{0%,8%{opacity:0;transform:translateY(12px)}18%,100%{opacity:.95;transform:none}}
    .fade{position:absolute;inset:0;background:#000;animation:fade ${dur}ms linear forwards}
    @keyframes fade{0%{opacity:1}6%{opacity:0}92%{opacity:0}100%{opacity:1}}
  </style></head><body>
    <div class="bg"></div><div class="sweep"></div>
    <div class="lights">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${38 + ((i * 53) % 34)}%;animation-delay:-${(i * 0.37) % 1.6}s"></i>`).join('')}</div>
    <div class="vig"></div>
    <img class="logo" src="file://${ROOT}/assets/img/logo-white.svg">
    <div class="fade"></div>
  </body></html>`;
  const scene = `${OUT}/${c.name}-scene.html`;
  writeFileSync(scene, html);
  await p.goto(`file://${scene}`);
  await p.waitForLoadState('load');
  await p.waitForTimeout(600);
  const dir = `${OUT}/${c.name}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = FPS * SECONDS;
  for (let f = 0; f < frames; f++) {
    const time = (f / FPS) * 1000;
    await p.evaluate((tm) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = tm; }), time);
    await p.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.png` });
  }
  await p.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', `${OUT}/${c.name}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}/f0060.png`, '-q:v', '4', `${OUT}/${c.name}.jpg`]);
  rmSync(dir, { recursive: true, force: true });
  rmSync(scene, { force: true });
  console.log('fertig', c.name);
}
await b.close();
