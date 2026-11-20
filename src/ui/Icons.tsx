import React from 'react';

export function NammaRunnerLogo({ className = 'w-full max-w-[380px] h-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 476 138"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="NAMMA RUNNER: Bengaluru Metro Rush"
    >
      <defs>
        <linearGradient id="nrBannerGrad" x1="12" y1="14" x2="464" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7B2CBF" />
          <stop offset="52%" stopColor="#5A189A" />
          <stop offset="100%" stopColor="#2DC653" />
        </linearGradient>
        <linearGradient id="nrGoldText" x1="0" y1="20" x2="0" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7B2" />
          <stop offset="45%" stopColor="#FFD60A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Hard comic offset drop shadow */}
      <path
        d="M22 24 L466 14 L452 96 L12 104 Z"
        fill="#1A1423"
      />

      {/* Main skewed Namma Metro banner */}
      <path
        d="M16 18 L460 8 L446 90 L6 98 Z"
        fill="url(#nrBannerGrad)"
        stroke="#1A1423"
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* Inner speed highlight bar */}
      <path
        d="M26 24 L448 15 L445 30 L24 38 Z"
        fill="#FFFFFF"
        fillOpacity="0.16"
      />

      {/* Left Purple/Green metro chevron stripes */}
      <path d="M18 82 L446 74 L443 85 L15 93 Z" fill="#FFD60A" fillOpacity="0.95" />

      {/* Title Wordmark — generous width inside 476 viewBox, zero clipping */}
      <g transform="rotate(-1.3 236 56)">
        <text
          x="236"
          y="68"
          textAnchor="middle"
          fontFamily="'Titan One', cursive, sans-serif"
          fontSize="39"
          letterSpacing="1.5"
          stroke="#1A1423"
          strokeWidth="10"
          strokeLinejoin="round"
          paintOrder="stroke"
          fill="#1A1423"
          transform="translate(3, 4)"
        >
          NAMMA RUNNER
        </text>
        <text
          x="236"
          y="68"
          textAnchor="middle"
          fontFamily="'Titan One', cursive, sans-serif"
          fontSize="39"
          letterSpacing="1.5"
          stroke="#1A1423"
          strokeWidth="9"
          strokeLinejoin="round"
          paintOrder="stroke"
          fill="url(#nrGoldText)"
        >
          NAMMA RUNNER
        </text>
      </g>

      {/* Subtitle badge */}
      <g transform="translate(88, 92) rotate(-1)">
        <rect x="3" y="4" width="300" height="32" rx="10" fill="#1A1423" />
        <rect
          x="0"
          y="0"
          width="300"
          height="32"
          rx="10"
          fill="#1A1423"
          stroke="#FFD60A"
          strokeWidth="3"
        />
        <text
          x="150"
          y="21"
          textAnchor="middle"
          fontFamily="'Fredoka', sans-serif"
          fontWeight="700"
          fontSize="14.5"
          letterSpacing="2.2"
          fill="#FFFFFF"
        >
          BENGALURU METRO RUSH
        </text>
      </g>
    </svg>
  );
}

export function MetroTokenIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#FFD60A" stroke="#1A1423" strokeWidth="2.8" />
      <circle cx="16" cy="16" r="10.2" fill="#7B2CBF" stroke="#FFF3B0" strokeWidth="1.6" />
      <path
        d="M11 21V11H13.4L18.6 17.5V11H21V21H18.6L13.4 14.5V21H11Z"
        fill="#FFD60A"
      />
    </svg>
  );
}

export function KaapiIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M11 7C11 5.5 12.5 5 12.5 3.5" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 6.5C16 5 17.5 4.5 17.5 3" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 7C21 5.5 22.5 5 22.5 3.5" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9 10H23L21.3 21H10.7L9 10Z"
        fill="#F59E0B"
        stroke="#1A1423"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 21H25.5L23.5 27.5H8.5L6.5 21Z"
        fill="#D97706"
        stroke="#1A1423"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <ellipse cx="16" cy="10.5" rx="6.2" ry="1.8" fill="#78350F" />
    </svg>
  );
}

export function AutoBoardIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 18C5 13 8.5 9 14 9H22L26.5 16.5V22H5V18Z"
        fill="#FFD60A"
        stroke="#1A1423"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M5 17H26.5V22H5V17Z" fill="#16A34A" stroke="#1A1423" strokeWidth="2" />
      <path d="M13 11H20.5L23.5 16H13V11Z" fill="#BAE6FD" stroke="#1A1423" strokeWidth="1.6" />
      <rect x="6" y="24" width="20" height="3.2" rx="1.6" fill="#00F5D4" stroke="#1A1423" strokeWidth="1.4" />
    </svg>
  );
}

export function DroneIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect x="4" y="9" width="9" height="3" rx="1.5" fill="#38BDF8" stroke="#1A1423" strokeWidth="1.6" />
      <rect x="19" y="9" width="9" height="3" rx="1.5" fill="#38BDF8" stroke="#1A1423" strokeWidth="1.6" />
      <path
        d="M11 13H21L23 22H9L11 13Z"
        fill="#7B2CBF"
        stroke="#1A1423"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17.5" r="2.5" fill="#FFD60A" />
      <path d="M12 22L10 27M20 22L22 27" stroke="#FF70A6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function DosaMagnetIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 7V17C8 21.4 11.6 25 16 25C20.4 25 24 21.4 24 17V7H19.5V17C19.5 18.9 17.9 20.5 16 20.5C14.1 20.5 12.5 18.9 12.5 17V7H8Z"
        fill="#EF4444"
        stroke="#1A1423"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="8" y="7" width="4.5" height="4.5" fill="#FDE047" stroke="#1A1423" strokeWidth="1.6" />
      <rect x="19.5" y="7" width="4.5" height="4.5" fill="#FDE047" stroke="#1A1423" strokeWidth="1.6" />
    </svg>
  );
}
