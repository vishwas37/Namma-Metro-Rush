import * as THREE from 'three';

export interface WorldShaderUniforms {
  uCurveX: { value: number };
  uCurveY: { value: number };
  uRimColor: { value: THREE.Color };
  uRimStrength: { value: number };
  uWetness: { value: number };
  uTime: { value: number };
}

export function createWorldShaderUniforms(): WorldShaderUniforms {
  return {
    uCurveX: { value: 0.0 },
    uCurveY: { value: 0.00072 },
    uRimColor: { value: new THREE.Color(0xbbe6ff) },
    uRimStrength: { value: 0.42 },
    uWetness: { value: 0.0 },
    uTime: { value: 0.0 },
  };
}

export interface CurvedShaderOptions {
  /** Enables lightweight Fresnel Rim Light + stylized hemisphere wrap (use only on PBR/lit materials) */
  rim?: boolean;
  /** Per-material rim multiplier */
  rimScale?: number;
  /** Adds subtle wet-surface micro-sheen during rain/monsoon */
  wetSheen?: boolean;
}

/**
 * Injects Subway Surfers quadratic world curvature + optional Fortnite-style
 * Fresnel rim lighting into any Three.js material via `onBeforeCompile`, using
 * a stable `customProgramCacheKey` so programs compile ONCE and never recompile.
 */
export function applyCurvedWorldShader<T extends THREE.Material>(
  material: T,
  uniforms: WorldShaderUniforms,
  options: CurvedShaderOptions = {},
): T {
  const enableRim = Boolean(options.rim);
  const rimScale = options.rimScale ?? 1.0;
  const wetSheen = Boolean(options.wetSheen);
  const cacheKey = `namma_curve_v2_rim${enableRim ? Math.round(rimScale * 10) : 0}_wet${wetSheen ? 1 : 0}`;

  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurveX = uniforms.uCurveX;
    shader.uniforms.uCurveY = uniforms.uCurveY;
    shader.uniforms.uRimColor = uniforms.uRimColor;
    shader.uniforms.uRimStrength = uniforms.uRimStrength;
    shader.uniforms.uWetness = uniforms.uWetness;
    shader.uniforms.uTime = uniforms.uTime;

    shader.vertexShader =
      `uniform float uCurveX;\nuniform float uCurveY;\n` +
      (wetSheen ? `varying vec3 vCurvedWorldPos;\n` : '') +
      shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        mvPosition = batchingMatrix * mvPosition;
      #endif
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      vec4 curvedWorldPos = modelMatrix * mvPosition;
      float curvedDz = min( 0.0, curvedWorldPos.z );
      float curvedDz2 = curvedDz * curvedDz;
      curvedWorldPos.x += uCurveX * curvedDz2;
      curvedWorldPos.y -= uCurveY * curvedDz2;
      ${wetSheen ? 'vCurvedWorldPos = curvedWorldPos.xyz;' : ''}
      mvPosition = viewMatrix * curvedWorldPos;
      gl_Position = projectionMatrix * mvPosition;
      `,
    );

    if (enableRim || wetSheen) {
      let fragHeader = '';
      if (enableRim) {
        fragHeader += `uniform vec3 uRimColor;\nuniform float uRimStrength;\n`;
      }
      if (wetSheen) {
        fragHeader += `uniform float uWetness;\nuniform float uTime;\nvarying vec3 vCurvedWorldPos;\n`;
      }
      shader.fragmentShader = fragHeader + shader.fragmentShader;

      let fragInject = '';
      if (enableRim) {
        fragInject += `
        vec3 nammaViewDir = normalize( vViewPosition );
        vec3 nammaN = normalize( normal );
        float nammaFresnel = pow( 1.0 - clamp( dot( nammaN, nammaViewDir ), 0.0, 1.0 ), 2.65 );
        float nammaHemi = clamp( nammaN.y * 0.5 + 0.5, 0.0, 1.0 );
        outgoingLight += uRimColor * nammaFresnel * (uRimStrength * ${rimScale.toFixed(2)})
          + vec3(0.035, 0.045, 0.06) * nammaHemi * (uRimStrength * ${(rimScale * 0.65).toFixed(2)});
        `;
      }
      if (wetSheen) {
        fragInject += `
        if (uWetness > 0.02) {
          float puddle = smoothstep(0.35, 0.85,
            sin(vCurvedWorldPos.x * 1.45 + 0.7) * cos(vCurvedWorldPos.z * 0.24 - uTime * 1.6) * 0.5 + 0.5
          );
          float grazing = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.1);
          outgoingLight += vec3(0.28, 0.48, 0.72) * puddle * grazing * uWetness * 0.55;
        }
        `;
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `${fragInject}\n#include <opaque_fragment>`,
      );
    }
  };

  return material;
}

export interface SkyDomeRig {
  mesh: THREE.Mesh;
  uniforms: {
    uTopColor: { value: THREE.Color };
    uMidColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uGroundColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunIntensity: { value: number };
  };
  dispose: () => void;
}

/**
 * Procedural Fortnite/Subway Surfers stylized gradient sky dome with glowing
 * Bengaluru sun disc and horizon scatter (zero external textures, 1 draw call).
 */
export function createSkyDome(): SkyDomeRig {
  const uniforms = {
    uTopColor: { value: new THREE.Color(0x1d7ed6) },
    uMidColor: { value: new THREE.Color(0x4fc3f7) },
    uHorizonColor: { value: new THREE.Color(0xc8f0ff) },
    uGroundColor: { value: new THREE.Color(0x3a6b52) },
    uSunColor: { value: new THREE.Color(0xfff4b8) },
    uSunDir: { value: new THREE.Vector3(0.38, 0.42, -0.82).normalize() },
    uSunIntensity: { value: 1.0 },
  };

  const geo = new THREE.SphereGeometry(215, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunIntensity;
      varying vec3 vDir;

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h >= 0.0) {
          float midT = smoothstep(0.0, 0.34, h);
          float topT = smoothstep(0.28, 0.88, h);
          col = mix(uHorizonColor, uMidColor, midT);
          col = mix(col, uTopColor, topT);
        } else {
          col = mix(uHorizonColor, uGroundColor, smoothstep(0.0, -0.25, h));
        }

        // Stylized sun disc + atmospheric halo
        float sunDot = max(0.0, dot(d, normalize(uSunDir)));
        float sunHalo = pow(sunDot, 14.0) * 0.38 * uSunIntensity;
        float sunCore = smoothstep(0.992, 0.9975, sunDot) * 1.15 * uSunIntensity;
        col += uSunColor * (sunHalo + sunCore);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    uniforms,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
