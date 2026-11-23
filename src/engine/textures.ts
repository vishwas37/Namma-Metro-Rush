import * as THREE from 'three';
import type { BillboardAd, MetroLine, MetroStation } from '../core/catalog';

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
  kannadaFlag: THREE.CanvasTexture;
  kannadaArchSign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  techFacade: THREE.CanvasTexture;
  getStationSign: (station: MetroStation) => THREE.CanvasTexture;
  createBillboard: (ad: BillboardAd) => THREE.CanvasTexture;
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

        // Karnataka Yellow + Red (Arishina-Kunkuma) safety edge strips
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, 10, h);
        ctx.fillRect(w - 10, 0, 10, h);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(10, 0, 6, h);
        ctx.fillRect(w - 16, 0, 6, h);
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

          // Top Karnataka Yellow-Red accent + Metro line stripe
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 6, w, 6);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 12, w, 6);
          ctx.fillStyle = stripe;
          ctx.fillRect(0, 18, w, 14);

          ctx.fillStyle = stripe;
          ctx.fillRect(0, h - 80, w, 36);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, h - 44, w, 7);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, h - 37, w, 7);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, h - 30, w, 30);

          for (let i = 0; i < 4; i++) {
            const x = 22 + i * 122;
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(x, 42, 48, 130);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x + 5, 52, 17, 72);
            ctx.fillRect(x + 26, 52, 17, 72);
            ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
            ctx.fillRect(x + 7, 55, 6, 62);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(x + 56, 50, 58, 70);
            ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
            ctx.beginPath();
            ctx.moveTo(x + 60, 116);
            ctx.lineTo(x + 84, 54);
            ctx.lineTo(x + 98, 54);
            ctx.lineTo(x + 74, 116);
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 22px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`ನಮ್ಮ ಮೆಟ್ರೋ • ${label}`, w / 2, h - 62);
        },
        maxAnisotropy,
      ),
    );

  const trainSidePurple = makeTrainSide('#7B2CBF', 'PURPLE LINE');
  const trainSideGreen = makeTrainSide('#2DC653', 'GREEN LINE');

  const makeTrainFront = (stripe: string, destKn: string, destEn: string) =>
    reg(
      makeCanvasTex(
        256,
        256,
        (ctx, w, h) => {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(0, 0, w, h);

          // Top Karnataka flag strip on train brow
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 0, w, 9);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 9, w, 9);

          ctx.fillStyle = '#111827';
          drawRoundedRect(ctx, 18, 24, w - 36, 128, 22);
          ctx.fill();

          ctx.fillStyle = '#1e293b';
          drawRoundedRect(ctx, 28, 58, w - 56, 84, 12);
          ctx.fill();

          ctx.fillStyle = 'rgba(147, 197, 253, 0.32)';
          ctx.fillRect(40, 66, 42, 68);

          ctx.fillStyle = '#050811';
          ctx.fillRect(36, 30, w - 72, 24);
          ctx.fillStyle = '#ffd60a';
          ctx.font = 'bold 12px "Noto Sans Kannada", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${destKn} · ${destEn}`, w / 2, 42, w - 80);

          ctx.fillStyle = stripe;
          ctx.fillRect(0, 160, w, 36);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 196, w, 8);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 204, w, 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 212, w, 44);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ', w / 2, 179);
        },
        maxAnisotropy,
      ),
    );

  const trainFrontPurple = makeTrainFront('#7B2CBF', 'ಮೆಜೆಸ್ಟಿಕ್', 'MAJESTIC');
  const trainFrontGreen = makeTrainFront('#2DC653', 'ಜಯನಗರ', 'JAYANAGAR');

  const bbmpHazard = reg(
    makeCanvasTex(
      512,
      192,
      (ctx, w, h) => {
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#dc2626';
        for (let x = -h; x < w + h; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 24, 0);
          ctx.lineTo(x - 16, 42);
          ctx.lineTo(x - 40, 42);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(x, h - 42);
          ctx.lineTo(x + 24, h - 42);
          ctx.lineTo(x - 16, h);
          ctx.lineTo(x - 40, h);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = '#1a1423';
        ctx.fillRect(14, 46, w - 28, h - 92);
        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 30px "Noto Sans Kannada", Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ಬಿ.ಬಿ.ಎಂ.ಪಿ ಕೆಲಸ • BBMP WORK', w / 2, h / 2 - 14, w - 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 22px "Noto Sans Kannada", Fredoka, sans-serif';
        ctx.fillText('ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ • JUMP!', w / 2, h / 2 + 22, w - 42);
      },
      maxAnisotropy,
    ),
  );

  const mindTheGap = reg(
    makeCanvasTex(
      512,
      160,
      (ctx, w, h) => {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(12, 12, w - 24, 24);
        ctx.fillRect(12, h - 36, w - 24, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px "Noto Sans Kannada", Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ಅಂತರ ಗಮನಿಸಿ • MIND THE GAP', w / 2, h / 2 - 8, w - 40);
        ctx.fillStyle = '#fef08a';
        ctx.font = '800 18px "Noto Sans Kannada", Fredoka, sans-serif';
        ctx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ • JUMP OVER', w / 2, h / 2 + 24);
      },
      maxAnisotropy,
    ),
  );

  const tunnelSign = reg(
    makeCanvasTex(
      512,
      160,
      (ctx, w, h) => {
        // Karnataka Yellow-over-Red top accent inside tunnel sign
        ctx.fillStyle = '#1a1423';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(8, 8, w - 16, 12);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(8, 20, w - 16, 10);
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 38px "Noto Sans Kannada", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ಸುರಂಗ ಮಾರ್ಗ', w / 2, 68);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 28px Fredoka, sans-serif';
        ctx.fillText('TUNNEL AHEAD • METRO', w / 2, 122);
      },
      maxAnisotropy,
    ),
  );

  const kannadaFlag = reg(
    makeCanvasTex(
      256,
      160,
      (ctx, w, h) => {
        // Authentic Karnataka Haldi-Kumkuma (Yellow top, Crimson Red bottom) flag
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, w, h / 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, h / 2, w, h / 2);

        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        ctx.fillStyle = '#1a1423';
        ctx.font = '900 34px "Noto Sans Kannada", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ಕನ್ನಡ', w / 2, h * 0.27);

        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 26px "Noto Sans Kannada", sans-serif';
        ctx.fillText('ನಮ್ಮ ಬೆಂಗಳೂರು', w / 2, h * 0.74, w - 24);
      },
      maxAnisotropy,
    ),
  );

  const kannadaArchSign = reg(
    makeCanvasTex(
      768,
      220,
      (ctx, w, h) => {
        // Iconic Arishina-Kunkuma (Yellow + Crimson Red) Bengaluru overhead welcome arch
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, w, h / 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, h / 2, w, h / 2);

        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, w - 14, h - 14);

        // Decorative divider bar
        ctx.fillStyle = '#1a1423';
        ctx.fillRect(14, h / 2 - 4, w - 28, 8);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#1a1423';
        ctx.font = '900 54px "Noto Sans Kannada", Fredoka, sans-serif';
        ctx.fillText('ಸಿರಿಗನ್ನಡಂ ಗೆಲ್ಗೆ • ನಮ್ಮ ಬೆಂಗಳೂರು', w / 2, h * 0.27, w - 56);

        ctx.fillStyle = '#ffd60a';
        ctx.font = '900 44px Fredoka, sans-serif';
        ctx.fillText('NAMMA METRO • JAI KARNATAKA!', w / 2, h * 0.74, w - 56);
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
        220,
        (ctx, w, h) => {
          ctx.fillStyle = '#1a1423';
          ctx.fillRect(0, 0, w, h);

          // Karnataka Yellow & Red pride strip across top
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(8, 8, w - 16, 12);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(8, 20, w - 16, 10);

          ctx.fillStyle = lineHex(station.line);
          ctx.fillRect(8, 30, w - 16, 40);

          ctx.fillStyle = '#ffffff';
          ctx.font = '800 22px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ • NAMMA METRO', w / 2, 50);

          ctx.fillStyle = '#ffd60a';
          ctx.font = '900 44px "Noto Sans Kannada", sans-serif';
          ctx.fillText(station.nameKn, w / 2, 114, w - 40);

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 34px Fredoka, sans-serif';
          ctx.fillText(station.nameEn.toUpperCase(), w / 2, 168, w - 40);

          ctx.strokeStyle = '#ffd60a';
          ctx.lineWidth = 6;
          ctx.strokeRect(5, 5, w - 10, h - 10);
        },
        maxAnisotropy,
      ),
    );
    stationCache.set(station.id, tex);
    return tex;
  };

  const createBillboard = (ad: BillboardAd) =>
    reg(
      makeCanvasTex(
        768,
        384,
        (ctx, w, h) => {
          // Bold poster background
          ctx.fillStyle = ad.bg;
          ctx.fillRect(0, 0, w, h);

          // Subtle diagonal comic speed bands
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          for (let sx = -120; sx < w + 120; sx += 96) {
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx + 44, 0);
            ctx.lineTo(sx - 36, h);
            ctx.lineTo(sx - 80, h);
            ctx.closePath();
            ctx.fill();
          }

          // Karnataka Yellow + Red outer comic frame
          ctx.strokeStyle = '#1a1423';
          ctx.lineWidth = 22;
          ctx.strokeRect(11, 11, w - 22, h - 22);

          // Top & bottom bold poster ribbons
          ctx.fillStyle = ad.stripe;
          ctx.fillRect(22, 22, w - 44, 24);
          ctx.fillStyle = ad.accent;
          ctx.fillRect(22, h - 46, w - 44, 24);

          // Tilted comic sticker badge in top-right corner
          ctx.save();
          ctx.translate(w - 148, 72);
          ctx.rotate(-0.08);
          ctx.fillStyle = '#1a1423';
          drawRoundedRect(ctx, -110, -24, 226, 52, 14);
          ctx.fill();
          ctx.fillStyle = '#ffd60a';
          drawRoundedRect(ctx, -116, -30, 226, 52, 14);
          ctx.fill();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = '#1a1423';
          ctx.font = '900 24px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ad.badge, -3, -3, 200);
          ctx.restore();

          // Huge bold outlined headline
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 58px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 14;
          ctx.strokeStyle = '#1a1423';
          ctx.strokeText(ad.headline, w / 2, h / 2 - 24, w - 76);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ad.headline, w / 2, h / 2 - 24, w - 76);

          // High-contrast bilingual punchline bar
          ctx.fillStyle = '#1a1423';
          drawRoundedRect(ctx, 42, h / 2 + 26, w - 84, 74, 16);
          ctx.fill();
          ctx.strokeStyle = ad.accent;
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = ad.accent;
          ctx.font = '900 34px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.fillText(ad.sub, w / 2, h / 2 + 64, w - 110);
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
    kannadaFlag,
    kannadaArchSign,
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
