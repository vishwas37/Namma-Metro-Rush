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
  trainFrontMajestic: THREE.CanvasTexture;
  bbmpHazard: THREE.CanvasTexture;
  mindTheGap: THREE.CanvasTexture;
  pillarHazard: THREE.CanvasTexture;
  mysteryBox: THREE.CanvasTexture;
  tunnelSign: THREE.CanvasTexture;
  kannadaFlag: THREE.CanvasTexture;
  kannadaArchSign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
  lightCone: THREE.CanvasTexture;
  techFacade: THREE.CanvasTexture;
  shopfrontFacade: THREE.CanvasTexture;
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

  // Stylized hand-painted Bengaluru Metro weathered viaduct concrete + ballast + gleaming twin steel rails
  const trackBed = reg(
    makeCanvasTex(
      512,
      512,
      (ctx, w, h) => {
        const bgGrad = ctx.createLinearGradient(0, 0, w, 0);
        bgGrad.addColorStop(0, '#5a6375');
        bgGrad.addColorStop(0.5, '#687387');
        bgGrad.addColorStop(1, '#5a6375');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Weathered concrete speckle & expansion seams
        for (let i = 0; i < 620; i++) {
          const x = (i * 73) % w;
          const y = (i * 137) % h;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.14)';
          ctx.fillRect(x, y, 4, 4);
        }
        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        for (let y = 0; y < h; y += 128) {
          ctx.fillRect(0, y, w, 3);
        }

        const laneCenters = [w * 0.19, w * 0.5, w * 0.81];
        const laneW = w * 0.255;
        for (const cx of laneCenters) {
          // Ballast trough
          ctx.fillStyle = '#333b4d';
          ctx.fillRect(cx - laneW / 2, 0, laneW, h);

          // Crushed granite ballast gravel speckles
          for (let g = 0; g < 160; g++) {
            const gx = cx - laneW * 0.45 + ((g * 41) % Math.floor(laneW * 0.9));
            const gy = (g * 97) % h;
            ctx.fillStyle = g % 3 === 0 ? 'rgba(226,232,240,0.18)' : 'rgba(15,23,42,0.28)';
            ctx.fillRect(gx, gy, 3, 3);
          }

          // Heavy concrete metro sleepers with beveled highlight & shadow
          for (let y = 10; y < h; y += 32) {
            ctx.fillStyle = '#7c879e';
            ctx.fillRect(cx - laneW * 0.43, y, laneW * 0.86, 13);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(cx - laneW * 0.43, y, laneW * 0.86, 3);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx - laneW * 0.43, y + 11, laneW * 0.86, 3);
          }

          // Gleaming twin steel rails + rail fasteners
          for (const ro of [-laneW * 0.3, laneW * 0.3]) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx + ro - 6, 0, 12, h);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(cx + ro - 4, 0, 8, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx + ro - 1.5, 0, 3, h);
          }

          // Iconic BMRCL yellow third-rail power shroud
          ctx.fillStyle = '#facc15';
          ctx.fillRect(cx + laneW * 0.44, 0, 5, h);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(cx + laneW * 0.44, 0, 2, h);
        }

        // Karnataka Yellow + Red (Arishina-Kunkuma) safety edge strips
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, 11, h);
        ctx.fillRect(w - 11, 0, 11, h);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(11, 0, 6, h);
        ctx.fillRect(w - 17, 0, 6, h);
      },
      maxAnisotropy,
      1,
      4,
    ),
  );

  // BEML Stainless-Steel Namma Metro coach sides with glossy windows & Kannada branding
  const makeTrainSide = (stripe: string, label: string) =>
    reg(
      makeCanvasTex(
        512,
        256,
        (ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.28, '#e2e8f0');
          grad.addColorStop(0.62, '#cbd5e1');
          grad.addColorStop(1, '#94a3b8');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Brushed stainless steel horizontal sheen bands
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(0, 34, w, 6);
          ctx.fillRect(0, 134, w, 4);

          // Top Karnataka Yellow-Red accent + Metro line stripe
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 6, w, 6);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 12, w, 6);
          ctx.fillStyle = stripe;
          ctx.fillRect(0, 18, w, 16);

          // Lower bold BMRCL livery band
          ctx.fillStyle = stripe;
          ctx.fillRect(0, h - 82, w, 38);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, h - 44, w, 7);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, h - 37, w, 7);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, h - 30, w, 30);

          for (let i = 0; i < 4; i++) {
            const x = 22 + i * 122;
            // Sliding stainless metro doors
            ctx.fillStyle = '#94a3b8';
            drawRoundedRect(ctx, x, 42, 48, 128, 6);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            drawRoundedRect(ctx, x + 5, 50, 17, 74, 4);
            ctx.fill();
            drawRoundedRect(ctx, x + 26, 50, 17, 74, 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
            ctx.fillRect(x + 7, 54, 6, 62);

            // Recessed tinted coach window with diagonal glass glint
            ctx.fillStyle = '#0b1222';
            drawRoundedRect(ctx, x + 56, 48, 58, 72, 8);
            ctx.fill();
            ctx.fillStyle = 'rgba(125, 211, 252, 0.34)';
            ctx.beginPath();
            ctx.moveTo(x + 61, 115);
            ctx.lineTo(x + 84, 52);
            ctx.lineTo(x + 98, 52);
            ctx.lineTo(x + 75, 115);
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 22px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`ನಮ್ಮ ಮೆಟ್ರೋ • ${label}`, w / 2, h - 63);
        },
        maxAnisotropy,
      ),
    );

  const trainSidePurple = makeTrainSide('#7B2CBF', 'PURPLE LINE');
  const trainSideGreen = makeTrainSide('#2DC653', 'GREEN LINE');

  // Glossy BEML train nose with glowing bilingual LED destination header
  const makeTrainFront = (stripe: string, destEn: string, destKn: string) =>
    reg(
      makeCanvasTex(
        256,
        256,
        (ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.55, '#e2e8f0');
          grad.addColorStop(1, '#cbd5e1');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Top Karnataka flag brow strip
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 0, w, 9);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 9, w, 9);

          // Aerodynamic black cab bezel
          ctx.fillStyle = '#0b1020';
          drawRoundedRect(ctx, 16, 22, w - 32, 134, 24);
          ctx.fill();

          // Glowing orange-gold LED destination matrix
          ctx.fillStyle = '#050811';
          drawRoundedRect(ctx, 28, 29, w - 56, 30, 6);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#ffd60a';
          ctx.font = '900 12px "Noto Sans Kannada", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${destEn} / ${destKn}`, w / 2, 44, w - 66);

          // Recessed panoramic cab windshield with Fortnite-style stylized specular slash
          const windGrad = ctx.createLinearGradient(0, 62, 0, 148);
          windGrad.addColorStop(0, '#1e3a5f');
          windGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = windGrad;
          drawRoundedRect(ctx, 26, 63, w - 52, 84, 14);
          ctx.fill();

          ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
          ctx.beginPath();
          ctx.moveTo(40, 142);
          ctx.lineTo(78, 67);
          ctx.lineTo(106, 67);
          ctx.lineTo(68, 142);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(114, 142);
          ctx.lineTo(152, 67);
          ctx.lineTo(164, 67);
          ctx.lineTo(126, 142);
          ctx.closePath();
          ctx.fill();

          // Bold Metro line chevron nose stripe
          ctx.fillStyle = stripe;
          ctx.fillRect(0, 160, w, 36);
          ctx.fillStyle = '#ffd60a';
          ctx.fillRect(0, 196, w, 8);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, 204, w, 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 212, w, 44);

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 20px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.fillText('ನಮ್ಮ ಮೆಟ್ರೋ', w / 2, 179);
        },
        maxAnisotropy,
      ),
    );

  const trainFrontPurple = makeTrainFront('#7B2CBF', 'WHITEFIELD', 'ವೈಟ್‌ಫೀಲ್ಡ್');
  const trainFrontGreen = makeTrainFront('#2DC653', 'SILK INSTITUTE', 'ಸಿಲ್ಕ್ ಇನ್ಸ್ಟಿಟ್ಯೂಟ್');
  const trainFrontMajestic = makeTrainFront('#7B2CBF', 'MAJESTIC', 'ಮೆಜೆಸ್ಟಿಕ್');

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

  const pillarHazard = reg(
    makeCanvasTex(
      128,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, w, h);
        // Yellow-black warning chevron collar at eye height
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, h * 0.42, w, h * 0.24);
        ctx.fillStyle = '#1a1423';
        for (let y = h * 0.42 - 32; y < h * 0.66 + 32; y += 26) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + 18);
          ctx.lineTo(w, y + 30);
          ctx.lineTo(0, y + 12);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#7b2cbf';
        ctx.fillRect(0, 0, w, 24);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 24, w, 12);
      },
      maxAnisotropy,
    ),
  );

  const mysteryBox = reg(
    makeCanvasTex(
      256,
      256,
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#7b2cbf');
        grad.addColorStop(0.5, '#5b21b6');
        grad.addColorStop(1, '#3b0764');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 6;
        ctx.strokeRect(26, 26, w - 52, h - 52);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 132px "Titan One", Fredoka, sans-serif';
        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 14;
        ctx.strokeText('?', w / 2, h / 2 + 8);
        ctx.fillStyle = '#ffd60a';
        ctx.fillText('?', w / 2, h / 2 + 8);
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
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(0, 0, w, h / 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, h / 2, w, h / 2);

        ctx.strokeStyle = '#1a1423';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, w - 14, h - 14);
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
        grad.addColorStop(0, 'rgba(12, 8, 24, 0.78)');
        grad.addColorStop(0.55, 'rgba(12, 8, 24, 0.36)');
        grad.addColorStop(1, 'rgba(12, 8, 24, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      },
      1,
    ),
  );

  // Soft radial fake-bloom additive glow sprite texture (headlights, halos, thrusters, glints)
  const glowSprite = reg(
    makeCanvasTex(
      128,
      128,
      (ctx, w, h) => {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.75)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.22)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      },
      1,
    ),
  );

  // Volumetric headlight light-cone texture
  const lightCone = reg(
    makeCanvasTex(
      128,
      256,
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255, 248, 196, 0.65)');
        grad.addColorStop(0.45, 'rgba(255, 240, 160, 0.24)');
        grad.addColorStop(1, 'rgba(255, 240, 160, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(w * 0.34, 0);
        ctx.lineTo(w * 0.66, 0);
        ctx.lineTo(w * 0.98, h);
        ctx.lineTo(w * 0.02, h);
        ctx.closePath();
        ctx.fill();
      },
      1,
    ),
  );

  const techFacade = reg(
    makeCanvasTex(
      256,
      512,
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#16385c');
        grad.addColorStop(1, '#0f2540');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        for (let y = 12; y < h; y += 28) {
          for (let x = 10; x < w - 10; x += 26) {
            const hash = (x * 13 + y * 7) % 7;
            ctx.fillStyle =
              hash === 0 ? '#bae6fd' : hash === 3 ? '#fef08a' : '#2c4c70';
            ctx.fillRect(x, y, 18, 18);
          }
          ctx.fillStyle = '#0a1829';
          ctx.fillRect(0, y + 20, w, 4);
        }
      },
      maxAnisotropy,
    ),
  );

  // Colorful Bengaluru Indiranagar / Jayanagar shopfront building texture
  const shopfrontFacade = reg(
    makeCanvasTex(
      256,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#f59e6c';
        ctx.fillRect(0, 0, w, h);

        // Upper apartment balconies
        for (let y = 24; y < h - 140; y += 54) {
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(16, y, w - 32, 34);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(26, y + 6, 46, 22);
          ctx.fillRect(w - 72, y + 6, 46, 22);
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(16, y + 28, w - 32, 8);
        }

        // Ground-level Darshini / Cafe striped awning
        ctx.fillStyle = '#1a1423';
        ctx.fillRect(0, h - 125, w, 125);
        for (let x = 0; x < w; x += 32) {
          ctx.fillStyle = (x / 32) % 2 === 0 ? '#dc2626' : '#ffd60a';
          ctx.fillRect(x, h - 125, 32, 26);
        }
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(22, h - 86, w - 44, 62);
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
          ctx.fillStyle = ad.bg;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          for (let sx = -120; sx < w + 120; sx += 96) {
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx + 44, 0);
            ctx.lineTo(sx - 36, h);
            ctx.lineTo(sx - 80, h);
            ctx.closePath();
            ctx.fill();
          }

          ctx.strokeStyle = '#1a1423';
          ctx.lineWidth = 22;
          ctx.strokeRect(11, 11, w - 22, h - 22);

          ctx.fillStyle = ad.stripe;
          ctx.fillRect(22, 22, w - 44, 24);
          ctx.fillStyle = ad.accent;
          ctx.fillRect(22, h - 46, w - 44, 24);

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

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 58px "Noto Sans Kannada", Fredoka, sans-serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 14;
          ctx.strokeStyle = '#1a1423';
          ctx.strokeText(ad.headline, w / 2, h / 2 - 24, w - 76);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ad.headline, w / 2, h / 2 - 24, w - 76);

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
    trainFrontMajestic,
    bbmpHazard,
    mindTheGap,
    pillarHazard,
    mysteryBox,
    tunnelSign,
    kannadaFlag,
    kannadaArchSign,
    contactShadow,
    glowSprite,
    lightCone,
    techFacade,
    shopfrontFacade,
    getStationSign,
    createBillboard,
    dispose: () => {
      for (const tex of created) tex.dispose();
      stationCache.clear();
    },
  };
}
