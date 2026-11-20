import * as THREE from 'three';
import type { MetroLine, MetroStation } from '../core/catalog';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  // Safari <16 & older WebView safe rounded rect helper (never depends on ctx.roundRect)
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makeCanvasTex(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, Math.max(1, maxAnisotropy));
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export interface TextureLibrary {
  trackBed: THREE.CanvasTexture;
  trainSidePurple: THREE.CanvasTexture;
  trainSideGreen: THREE.CanvasTexture;
  trainFrontPurple: THREE.CanvasTexture;
  trainFrontGreen: THREE.CanvasTexture;
  bbmpHazard: THREE.CanvasTexture;
  mindTheGap: THREE.CanvasTexture;
  tunnelSign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  techFacade: THREE.CanvasTexture;
  getStationSign: (station: MetroStation) => THREE.CanvasTexture;
  createBillboard: (headline: string, sub: string, bg: string, accent: string) => THREE.CanvasTexture;
  dispose: () => void;
}

export function createTextureLibrary(maxAnisotropy: number): TextureLibrary {
  const created: THREE.CanvasTexture[] = [];
  const stationCache = new Map<string, THREE.CanvasTexture>();
  const reg = (t: THREE.CanvasTexture) => {
    created.push(t);
    return t;
  };

  const trackBed = reg(
    makeCanvasTex(
      512,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#4a5263';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 550; i++) {
          const x = (i * 73) % w;
          const y = (i * 137) % h;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.12)';
          ctx.fillRect(x, y, 4, 4);
        }

        const laneCenters = [w * 0.19, w * 0.5, w * 0.81];
        const laneW = w * 0.25;
        for (const cx of laneCenters) {
          ctx.fillStyle = '#333b4a';
          ctx.fillRect(cx - laneW / 2, 0, laneW, h);

          for (let y = 12; y < h; y += 36) {
            ctx.fillStyle = '#6c758a';
            ctx.fillRect(cx - laneW * 0.43, y, laneW * 0.86, 14);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(cx - laneW * 0.43, y, laneW * 0.86, 3);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx - laneW * 0.43, y + 12, laneW * 0.86, 3);
          }

          for (const ro of [-laneW * 0.3, laneW * 0.3]) {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(cx + ro - 4, 0, 8, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx + ro - 1.5, 0, 3, h);
          }

          ctx.fillStyle = '#facc15';
          ctx.fillRect(cx + laneW * 0.44, 0, 5, h);
        }

        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, 12, h);
        ctx.fillRect(w - 12, 0, 12, h);
      },
      maxAnisotropy,
      1,
      4,
    ),
  );

  const makeTrainSide = (stripe: string, label: string) =>
    reg(
      makeCanvasTex(
        512,
        256,
        (ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#f8fafc');
          grad.addColorStop(0.55, '#e2e8f0');
          grad.addColorStop(1, '#cbd5e1');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = stripe;
          ctx.fillRect(0, 14, w, 18);
          ctx.fillRect(0, h - 78, w, 34);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, h - 44, w, 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, h - 28, w, 28);

          for (let i = 0; i < 4; i++) {
            const x = 22 + i * 122;
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(x, 42, 48, 134);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x + 5, 52, 17, 74);
            ctx.fillRect(x + 26, 52, 17, 74);
            ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
            ctx.fillRect(x + 7, 55, 6, 65);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x + 56, 50, 58, 72);
            ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
            ctx.beginPath();
            ctx.moveTo(x + 60, 118);
            ctx.lineTo(x + 84, 54);
            ctx.lineTo(x + 98, 54);
            ctx.lineTo(x + 74, 118);
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 22px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`NAMMA METRO • ${label}`, w / 2, h - 61);
        },
        maxAnisotropy,
      ),
    );

  const trainSidePurple = makeTrainSide('#7B2CBF', 'PURPLE LINE');
  const trainSideGreen = makeTrainSide('#2DC653', 'GREEN LINE');

  const makeTrainFront = (stripe: string, dest: string) =>
    reg(
      makeCanvasTex(
        256,
        256,
        (ctx, w, h) => {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = '#111827';
          drawRoundedRect(ctx, 20, 24, w - 40, 128, 22);
          ctx.fill();

          ctx.fillStyle = '#1e293b';
          drawRoundedRect(ctx, 30, 56, w - 60, 86, 12);
          ctx.fill();

          ctx.fillStyle = 'rgba(147, 197, 253, 0.32)';
          ctx.fillRect(42, 64, 42, 70);

          ctx.fillStyle = '#050811';
          ctx.fillRect(46, 30, w - 92, 22);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dest, w / 2, 41);

          ctx.fillStyle = stripe;
          ctx.fillRect(0, 162, w, 34);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 196, w, 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 212, w, 44);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ', w / 2, 180);
        },
        maxAnisotropy,
      ),
    );

  const trainFrontPurple = makeTrainFront('#7B2CBF', 'MAJESTIC');
  const trainFrontGreen = makeTrainFront('#2DC653', 'JAYANAGAR');

  const bbmpHazard = reg(
    makeCanvasTex(
      512,
      192,
      (ctx, w, h) => {
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1a1423';
        for (let x = -h; x < w + h; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 24, 0);
          ctx.lineTo(x - 16, 44);
          ctx.lineTo(x - 40, 44);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(x, h - 44);
          ctx.lineTo(x + 24, h - 44);
          ctx.lineTo(x - 16, h);
          ctx.lineTo(x - 40, h);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = '#1a1423';
        ctx.fillRect(16, 48, w - 32, h - 96);
        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 34px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BBMP WORK IN PROGRESS', w / 2, h / 2 - 12);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 20px Fredoka, sans-serif';
        ctx.fillText('SWALPA ADJUST MAADI • JUMP!', w / 2, h / 2 + 22);
      },
      maxAnisotropy,
    ),
  );

  const mindTheGap = reg(
    makeCanvasTex(
      512,
      160,
      (ctx, w, h) => {
        ctx.fillStyle = '#7b2cbf';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(12, 12, w - 24, 24);
        ctx.fillRect(12, h - 36, w - 24, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 38px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MIND THE GAP', w / 2, h / 2 - 8);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 18px Fredoka, sans-serif';
        ctx.fillText('NAMMA METRO • JUMP OVER', w / 2, h / 2 + 24);
      },
      maxAnisotropy,
    ),
  );

  const tunnelSign = reg(
    makeCanvasTex(
      512,
      160,
      (ctx, w, h) => {
        ctx.fillStyle = '#1a1423';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 40px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TUNNEL AHEAD', w / 2, 56);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 34px "Noto Sans Kannada", sans-serif';
        ctx.fillText('ಸುರಂಗ ಮಾರ್ಗ', w / 2, 114);
      },
      maxAnisotropy,
    ),
  );

  const contactShadow = reg(
    makeCanvasTex(
      128,
      128,
      (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(15, 10, 28, 0.72)');
        grad.addColorStop(0.55, 'rgba(15, 10, 28, 0.34)');
        grad.addColorStop(1, 'rgba(15, 10, 28, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      },
      1,
    ),
  );

  const techFacade = reg(
    makeCanvasTex(
      256,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(0, 0, w, h);
        for (let y = 12; y < h; y += 28) {
          for (let x = 10; x < w - 10; x += 26) {
            const lit = (x * 13 + y * 7) % 5 === 0;
            ctx.fillStyle = lit ? '#bae6fd' : '#334155';
            ctx.fillRect(x, y, 18, 18);
          }
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, y + 20, w, 4);
        }
      },
      maxAnisotropy,
    ),
  );

  const lineHex = (line: MetroLine): string => {
    if (line === 'green') return '#2DC653';
    if (line === 'yellow') return '#F59E0B';
    if (line === 'interchange') return '#6D28D9';
    return '#7B2CBF';
  };

  const getStationSign = (station: MetroStation) => {
    const existing = stationCache.get(station.id);
    if (existing) return existing;
    const tex = reg(
      makeCanvasTex(
        640,
        200,
        (ctx, w, h) => {
          ctx.fillStyle = '#1a1423';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = lineHex(station.line);
          ctx.fillRect(10, 10, w - 20, 44);

          ctx.fillStyle = '#ffffff';
          ctx.font = '800 22px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('NAMMA METRO • ನಮ್ಮ ಮೆಟ್ರೋ', w / 2, 32);

          ctx.fillStyle = '#ffd60a';
          ctx.font = '900 42px Fredoka, sans-serif';
          ctx.fillText(station.nameEn.toUpperCase(), w / 2, 100);

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 34px "Noto Sans Kannada", sans-serif';
          ctx.fillText(station.nameKn, w / 2, 156);

          ctx.strokeStyle = '#ffd60a';
          ctx.lineWidth = 6;
          ctx.strokeRect(6, 6, w - 12, h - 12);
        },
        maxAnisotropy,
      ),
    );
    stationCache.set(station.id, tex);
    return tex;
  };

  const createBillboard = (headline: string, sub: string, bg: string, accent: string) =>
    reg(
      makeCanvasTex(
        512,
        256,
        (ctx, w, h) => {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#1a1423';
          ctx.lineWidth = 14;
          ctx.strokeRect(7, 7, w - 14, h - 14);
          ctx.fillStyle = accent;
          ctx.fillRect(16, 16, w - 32, 14);
          ctx.fillRect(16, h - 30, w - 32, 14);

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 36px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(headline, w / 2, h / 2 - 22, w - 48);

          ctx.fillStyle = accent;
          ctx.font = '800 24px Fredoka, sans-serif';
          ctx.fillText(sub, w / 2, h / 2 + 34, w - 48);
        },
        maxAnisotropy,
      ),
    );

  return {
    trackBed,
    trainSidePurple,
    trainSideGreen,
    trainFrontPurple,
    trainFrontGreen,
    bbmpHazard,
    mindTheGap,
    tunnelSign,
    contactShadow,
    techFacade,
    getStationSign,
    createBillboard,
    dispose: () => {
      for (const tex of created) tex.dispose();
      stationCache.clear();
    },
  };
}
