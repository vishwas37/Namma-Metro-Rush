export type MetroLine = 'purple' | 'green' | 'yellow' | 'interchange';
export type ZoneMode = 'elevated' | 'underground';
export type WeatherMode = 'sunny' | 'light_rain' | 'heavy_monsoon';
export type PowerUpType = 'kaapi' | 'magnet' | 'drone';
export type UpgradeKey = 'kaapi' | 'magnet' | 'drone' | 'hoverboard';
export type CharacterId = 'techie' | 'skater' | 'auto_anna' | 'kaapi_master';
export type HoverboardId = 'classic_auto' | 'bmtc_volvo' | 'startup_unicorn';
export type GraphicsQuality = 'high' | 'eco';

export const WEATHER_META: Record<
  WeatherMode,
  { label: string; labelKn: string; slippery: boolean }
> = {
  sunny: { label: 'Sunny', labelKn: 'ಬಿಸಿಲು', slippery: false },
  light_rain: { label: 'Light Rain', labelKn: 'ಸಣ್ಣ ಮಳೆ', slippery: false },
  heavy_monsoon: { label: 'Heavy Monsoon', labelKn: 'ಭಾರೀ ಮಳೆ', slippery: true },
};

export interface MetroStation {
  id: string;
  nameEn: string;
  nameKn: string;
  line: MetroLine;
  zone: ZoneMode;
  subEn: string;
  subKn: string;
}

export const ELEVATED_STATIONS: MetroStation[] = [
  {
    id: 'indiranagar',
    nameEn: 'Indiranagar',
    nameKn: 'ಇಂದಿರಾನಗರ',
    line: 'purple',
    zone: 'elevated',
    subEn: 'Doors will open on the left',
    subKn: 'ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ',
  },
  {
    id: 'mg_road',
    nameEn: 'MG Road',
    nameKn: 'ಎಂ.ಜಿ. ರಸ್ತೆ',
    line: 'purple',
    zone: 'elevated',
    subEn: 'Doors will open on the left',
    subKn: 'ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ',
  },
  {
    id: 'jayanagar',
    nameEn: 'Jayanagar',
    nameKn: 'ಜಯನಗರ',
    line: 'green',
    zone: 'elevated',
    subEn: 'Green Line Express',
    subKn: 'ಹಸಿರು ಮಾರ್ಗದ ಎಕ್ಸ್‌ಪ್ರೆಸ್',
  },
  {
    id: 'whitefield',
    nameEn: 'Whitefield (Kadugodi)',
    nameKn: 'ವೈಟ್‌ಫೀಲ್ಡ್ (ಕಾಡುಗೋಡಿ)',
    line: 'purple',
    zone: 'elevated',
    subEn: 'Tech Corridor Terminus',
    subKn: 'ಟೆಕ್ ಕಾರಿಡಾರ್ ನಿಲ್ದಾಣ',
  },
  {
    id: 'baiyappanahalli',
    nameEn: 'Baiyappanahalli',
    nameKn: 'ಬೈಯಪ್ಪನಹಳ್ಳಿ',
    line: 'purple',
    zone: 'elevated',
    subEn: 'Doors will open on the left',
    subKn: 'ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ',
  },
  {
    id: 'silk_board',
    nameEn: 'Silk Board',
    nameKn: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್',
    line: 'yellow',
    zone: 'elevated',
    subEn: 'Faster than traffic below!',
    subKn: 'ಕೆಳಗಿನ ಟ್ರಾಫಿಕ್‌ಗಿಂತ ವೇಗ!',
  },
  {
    id: 'electronic_city',
    nameEn: 'Electronic City',
    nameKn: 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ',
    line: 'yellow',
    zone: 'elevated',
    subEn: 'Yellow Line Elevated Flyover',
    subKn: 'ಹಳದಿ ಮಾರ್ಗದ ಎತ್ತರದ ನಿಲ್ದಾಣ',
  },
];

export const UNDERGROUND_STATIONS: MetroStation[] = [
  {
    id: 'majestic',
    nameEn: 'Majestic (Kempegowda)',
    nameKn: 'ಮೆಜೆಸ್ಟಿಕ್ (ಕೆಂಪೇಗೌಡ ನಿಲ್ದಾಣ)',
    line: 'interchange',
    zone: 'underground',
    subEn: 'Interchange for Green Line',
    subKn: 'ಹಸಿರು ಮಾರ್ಗಕ್ಕೆ ಬದಲಾವಣೆ',
  },
  {
    id: 'cubbon_park',
    nameEn: 'Cubbon Park',
    nameKn: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್',
    line: 'purple',
    zone: 'underground',
    subEn: 'Doors will open on the left',
    subKn: 'ಬಾಗಿಲುಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ',
  },
  {
    id: 'vidhana_soudha',
    nameEn: 'Vidhana Soudha',
    nameKn: 'ವಿಧಾನ ಸೌಧ',
    line: 'purple',
    zone: 'underground',
    subEn: 'Dr. B.R. Ambedkar Station',
    subKn: 'ಡಾ. ಬಿ.ಆರ್. ಅಂಬೇಡ್ಕರ್ ನಿಲ್ದಾಣ',
  },
  {
    id: 'kr_market',
    nameEn: 'KR Market',
    nameKn: 'ಕೆ.ಆರ್. ಮಾರುಕಟ್ಟೆ',
    line: 'green',
    zone: 'underground',
    subEn: 'Interchange for Purple Line',
    subKn: 'ನೇರಳೆ ಮಾರ್ಗಕ್ಕೆ ಬದಲಾವಣೆ',
  },
];

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  shortName: string;
  tagline: string;
  cost: number;
  accentHex: string;
  primaryColor: number;
  secondaryColor: number;
  skinColor: number;
  hairColor: number;
  shoeColor: number;
}

export const CHARACTERS: CharacterSpec[] = [
  {
    id: 'techie',
    name: 'Techie Bro',
    shortName: 'Techie',
    tagline: 'Purple hoodie, ID lanyard & laptop backpack',
    cost: 0,
    accentHex: '#7B2CBF',
    primaryColor: 0x7b2cbf,
    secondaryColor: 0x1e293b,
    skinColor: 0xd99b66,
    hairColor: 0x1a1423,
    shoeColor: 0xffd60a,
  },
  {
    id: 'skater',
    name: 'Indiranagar Skater',
    shortName: 'Skater',
    tagline: 'Neon jacket, shades & 100ft Rd drip',
    cost: 150,
    accentHex: '#FF70A6',
    primaryColor: 0xff4d8d,
    secondaryColor: 0x06b6d4,
    skinColor: 0xc68652,
    hairColor: 0x24162b,
    shoeColor: 0x2dc653,
  },
  {
    id: 'auto_anna',
    name: 'Classic Auto Anna',
    shortName: 'Auto Anna',
    tagline: 'Khaki uniform, shades & one-and-half pride',
    cost: 300,
    accentHex: '#FFD60A',
    primaryColor: 0xd4a359,
    secondaryColor: 0x1f6f3c,
    skinColor: 0xb67442,
    hairColor: 0x151217,
    shoeColor: 0x3b2f2f,
  },
  {
    id: 'kaapi_master',
    name: 'Filter Kaapi Master',
    shortName: 'Kaapi Master',
    tagline: 'Crisp kurta & golden davara energy',
    cost: 500,
    accentHex: '#2DC653',
    primaryColor: 0xf8fafc,
    secondaryColor: 0xd97706,
    skinColor: 0xc98855,
    hairColor: 0x2a2433,
    shoeColor: 0x78350f,
  },
];

export interface HoverboardSpec {
  id: HoverboardId;
  name: string;
  tagline: string;
  cost: number;
  accentHex: string;
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
}

export const HOVERBOARDS: HoverboardSpec[] = [
  {
    id: 'classic_auto',
    name: 'Turbo Auto-Rickshaw',
    tagline: 'Green & yellow hovering auto with horn blast',
    cost: 0,
    accentHex: '#FFD60A',
    primaryColor: 0x1e9b4b,
    secondaryColor: 0xffd60a,
    glowColor: 0x00f5d4,
  },
  {
    id: 'bmtc_volvo',
    name: 'BMTC Volvo Mini',
    tagline: 'Vajra blue AC aero-sled with twin turbines',
    cost: 220,
    accentHex: '#0EA5E9',
    primaryColor: 0x0284c7,
    secondaryColor: 0xe2e8f0,
    glowColor: 0x38bdf8,
  },
  {
    id: 'startup_unicorn',
    name: 'Startup Unicorn',
    tagline: 'Series-C violet rocket board with gold fins',
    cost: 420,
    accentHex: '#A855F7',
    primaryColor: 0x7b2cbf,
    secondaryColor: 0xffd60a,
    glowColor: 0xff70a6,
  },
];

export interface UpgradeSpec {
  key: UpgradeKey;
  name: string;
  description: string;
  baseDuration: number;
  perLevelBonus: number;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADES: UpgradeSpec[] = [
  {
    key: 'kaapi',
    name: 'Filter Kaapi Boost',
    description: 'Longer invincible brass-tumbler hyper-dash',
    baseDuration: 5.5,
    perLevelBonus: 1.25,
    maxLevel: 5,
    baseCost: 80,
  },
  {
    key: 'magnet',
    name: 'Masala Dosa Magnet',
    description: 'Pulls Metro Tokens across all 3 lanes longer',
    baseDuration: 8.0,
    perLevelBonus: 1.75,
    maxLevel: 5,
    baseCost: 70,
  },
  {
    key: 'drone',
    name: 'Startup Drone Flight',
    description: 'Soar higher & longer collecting aerial arcs',
    baseDuration: 7.0,
    perLevelBonus: 1.5,
    maxLevel: 5,
    baseCost: 90,
  },
  {
    key: 'hoverboard',
    name: 'Auto Hoverboard Shield',
    description: 'Extended hoverboard ride & quicker recharge',
    baseDuration: 10.0,
    perLevelBonus: 2.0,
    maxLevel: 5,
    baseCost: 75,
  },
];

export interface BillboardAd {
  headline: string;
  sub: string;
  badge: string;
  bg: string;
  accent: string;
  stripe: string;
}

export const BILLBOARDS: BillboardAd[] = [
  {
    headline: 'STUCK AT SILK BOARD?',
    sub: 'ಬೇಗ ಹೋಗು! TAKE NAMMA METRO!',
    badge: 'ETA: 2045',
    bg: '#DC2626',
    accent: '#FFD60A',
    stripe: '#FFD60A',
  },
  {
    headline: 'AUTO ANNA: "WON\'T COME!"',
    sub: 'ಒಂದೂವರೆ ಮೀಟರ್! 1.5x METER ONLY',
    badge: 'METER DOWN',
    bg: '#166534',
    accent: '#FFD60A',
    stripe: '#DC2626',
  },
  {
    headline: 'AI-POWERED MASALA DOSA',
    sub: 'ಸಕ್ಕತ್ ಕ್ರಿಸ್ಪಿ • SEED FUNDED $50M',
    badge: 'INDIRANAGAR',
    bg: '#1A1423',
    accent: '#FFD60A',
    stripe: '#2DC653',
  },
  {
    headline: 'KORAMANGALA 1BHK RENT:',
    sub: '1 KIDNEY + 10 MONTHS DEPOSIT!',
    badge: 'NO BACHELORS',
    bg: '#7B2CBF',
    accent: '#FFD60A',
    stripe: '#DC2626',
  },
  {
    headline: 'THIS MEETING COULD BE',
    sub: 'ಒಂದು ಬೈ-ಟು ಫಿಲ್ಟರ್ ಕಾಫಿ! (BY-2 KAAPI)',
    badge: 'WFH MACHA',
    bg: '#0F172A',
    accent: '#FF70A6',
    stripe: '#FFD60A',
  },
  {
    headline: 'SWALPA ADJUST MAADI!',
    sub: 'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ • ROOM FOR 1 MORE',
    badge: 'BMTC VOLVO',
    bg: '#B91C1C',
    accent: '#FEF08A',
    stripe: '#FFD60A',
  },
  {
    headline: 'BENGALURU WEATHER:',
    sub: 'ಬಿಸಿಲು + ಮಳೆ + ಟ್ರಾಫಿಕ್ IN 10 MINS!',
    badge: 'PEAK BLR',
    bg: '#1E3A8A',
    accent: '#38BDF8',
    stripe: '#FFD60A',
  },
  {
    headline: 'HOT DEGREE FILTER KAAPI',
    sub: 'ಬಿಸಿ ಬಿಸಿ ಕಾಫಿ • DARSHINI WI-FI',
    badge: 'NEXT EXIT',
    bg: '#78350F',
    accent: '#FDE047',
    stripe: '#DC2626',
  },
  {
    headline: 'FOUNDER SEEKING CO-FOUNDER',
    sub: 'MUST OWN FLAT NEAR METRO STATION',
    badge: 'HSR LAYOUT',
    bg: '#4C1D95',
    accent: '#FFD60A',
    stripe: '#2DC653',
  },
  {
    headline: 'ಸಿರಿಗನ್ನಡಂ ಗೆಲ್ಗೆ! NAMMA BLR',
    sub: 'ಹಳದಿ-ಕೆಂಪು PRIDE • RIDE THE METRO!',
    badge: 'ಕನ್ನಡ',
    bg: '#DC2626',
    accent: '#FFD60A',
    stripe: '#FFD60A',
  },
];

export const CLOSE_CALL_QUIPS = [
  'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ! ADJUST MAADI!',
  'ಒಂದೂವರೆ DODGE! 1.5x!',
  'ಸಕ್ಕತ್! SAKKATH DODGE!',
  'ಬೆಂಕಿ! BENKI CLOSE CALL!',
  'ಸೂಪರ್ ಗುರು! SUPER GURU!',
  'ಮಚ್ಚಾ! PEAK BENGALURU!',
];

export const SPEED_BOOST_QUIPS = [
  'ಬೆಂಕಿ ಸ್ಪೀಡ್! KAAPI OVERDRIVE!',
  'FASTER THAN SILK BOARD!',
  'ಸಕ್ಕತ್! DEGREE COFFEE TURBO!',
];

export const GAME_OVER_QUIPS = [
  'ಆಟೋ ಅಣ್ಣ: "ಬರಲ್ಲ!" (Won\'t Come!)',
  'Stuck at Silk Board Junction!',
  'Forgot your ನಮ್ಮ ಮೆಟ್ರೋ Smart Card!',
  'BBMP Dug Up This Track Again!',
  'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ! Missed the Train!',
  'Meter Down! Next Metro in 2 Mins!',
  'Peak Bengaluru Moment, Guru!',
];

export type MissionMetric = 'tokens' | 'stations' | 'kaapi' | 'closeCalls';

export interface DailyMission {
  id: string;
  label: string;
  metric: MissionMetric;
  target: number;
  progress: number;
  completed: boolean;
  rewardTokens: number;
}

export interface PlayerProfile {
  tokens: number;
  highScore: number;
  bestDistance: number;
  unlockedCharacters: CharacterId[];
  selectedCharacter: CharacterId;
  unlockedHoverboards: HoverboardId[];
  selectedHoverboard: HoverboardId;
  upgrades: Record<UpgradeKey, number>;
  missionTier: number;
  missions: DailyMission[];
  soundMuted: boolean;
  announcerEnabled: boolean;
  quality: GraphicsQuality;
  touchButtonsEnabled: boolean;
}

const STORAGE_KEY = 'namma_runner_v2_profile';

export function createMissionsForTier(tier: number): DailyMission[] {
  const s = Math.max(1, tier);
  return [
    {
      id: `tokens_${s}`,
      label: `Collect ${40 * s} Metro Tokens`,
      metric: 'tokens',
      target: 40 * s,
      progress: 0,
      completed: false,
      rewardTokens: 50 * s,
    },
    {
      id: `stations_${s}`,
      label: s === 1 ? 'Pass 2 Namma Metro Stations' : `Pass ${2 + s} Metro Stations`,
      metric: 'stations',
      target: s === 1 ? 2 : 2 + s,
      progress: 0,
      completed: false,
      rewardTokens: 60 * s,
    },
    {
      id: `skill_${s}`,
      label: s % 2 === 1 ? `Grab ${s} Filter Kaapi Boost${s > 1 ? 's' : ''}` : `Pull off ${2 + s} Close Calls`,
      metric: s % 2 === 1 ? 'kaapi' : 'closeCalls',
      target: s % 2 === 1 ? s : 2 + s,
      progress: 0,
      completed: false,
      rewardTokens: 55 * s,
    },
  ];
}

export function createDefaultProfile(): PlayerProfile {
  return {
    tokens: 60,
    highScore: 0,
    bestDistance: 0,
    unlockedCharacters: ['techie'],
    selectedCharacter: 'techie',
    unlockedHoverboards: ['classic_auto'],
    selectedHoverboard: 'classic_auto',
    upgrades: {
      kaapi: 1,
      magnet: 1,
      drone: 1,
      hoverboard: 1,
    },
    missionTier: 1,
    missions: createMissionsForTier(1),
    soundMuted: false,
    announcerEnabled: true,
    quality: 'high',
    touchButtonsEnabled: false,
  };
}

export function loadProfile(): PlayerProfile {
  const fallback = createDefaultProfile();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      ...fallback,
      ...parsed,
      upgrades: {
        ...fallback.upgrades,
        ...(parsed.upgrades ?? {}),
      },
      unlockedCharacters:
        Array.isArray(parsed.unlockedCharacters) && parsed.unlockedCharacters.length > 0
          ? parsed.unlockedCharacters
          : fallback.unlockedCharacters,
      unlockedHoverboards:
        Array.isArray(parsed.unlockedHoverboards) && parsed.unlockedHoverboards.length > 0
          ? parsed.unlockedHoverboards
          : fallback.unlockedHoverboards,
      missions:
        Array.isArray(parsed.missions) && parsed.missions.length === 3
          ? parsed.missions
          : fallback.missions,
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage restricted (private browsing/quota)
  }
}
