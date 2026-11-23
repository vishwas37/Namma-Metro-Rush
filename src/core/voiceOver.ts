export type VoiceOverEvent = 'run_start' | 'kaapi' | 'magnet' | 'drone' | 'hoverboard';

export interface VoiceOverPhrase {
  id: string;
  event: VoiceOverEvent;
  /** Romanized Kannada/Kanglish phrase shown prominently in the HUD */
  romanized: string;
  /** Native Kannada script */
  kannada: string;
  /** Short English translation shown beneath */
  meaning: string;
  /** Utterance text when a native Kannada (kn-IN) TTS voice is available */
  spokenKn: string;
  /** Phonetic utterance text for Indian English (en-IN) or generic fallback voices */
  spokenEnIn: string;
  pitch: number;
  rate: number;
}

export interface SpeechVoiceDescriptor {
  lang: string;
  name?: string;
  default?: boolean;
}

export const KANNADA_VOICE_OVER_PHRASES: Record<VoiceOverEvent, VoiceOverPhrase[]> = {
  run_start: [
    {
      id: 'start_time_barutte',
      event: 'run_start',
      romanized: 'Run, Nimma time barutte!',
      kannada: 'ಓಡು, ನಿಮ್ಮ ಟೈಮ್ ಬರುತ್ತೆ!',
      meaning: 'Your time will come!',
      spokenKn: 'ಓಡು, ನಿಮ್ಮ ಟೈಮ್ ಬರುತ್ತೆ!',
      spokenEnIn: 'Run, Nimma time barutte!',
      pitch: 1.08,
      rate: 1.05,
    },
    {
      id: 'start_bega_odi',
      event: 'run_start',
      romanized: 'Bega odi, guru!',
      kannada: 'ಬೇಗ ಓಡಿ, ಗುರು!',
      meaning: 'Run fast, guru!',
      spokenKn: 'ಬೇಗ ಓಡಿ, ಗುರು!',
      spokenEnIn: 'Bega odi, guru!',
      pitch: 1.12,
      rate: 1.08,
    },
    {
      id: 'start_shuru_maadona',
      event: 'run_start',
      romanized: 'Shuru maadona, macha!',
      kannada: 'ಶುರು ಮಾಡೋಣ, ಮಚ್ಚಾ!',
      meaning: "Let's get started, buddy!",
      spokenKn: 'ಶುರು ಮಾಡೋಣ, ಮಚ್ಚಾ!',
      spokenEnIn: 'Shuru maadona, macha!',
      pitch: 1.1,
      rate: 1.06,
    },
    {
      id: 'start_metro_tappisbeda',
      event: 'run_start',
      romanized: 'Metro tappisbeda, odi!',
      kannada: 'ಮೆಟ್ರೋ ತಪ್ಪಿಸ್ಬೇಡ, ಓಡಿ!',
      meaning: "Don't miss the Metro, run!",
      spokenKn: 'ಮೆಟ್ರೋ ತಪ್ಪಿಸ್ಬೇಡ, ಓಡಿ!',
      spokenEnIn: 'Metro tappisbeda, odi!',
      pitch: 1.06,
      rate: 1.08,
    },
    {
      id: 'start_namma_ooru',
      event: 'run_start',
      romanized: 'Namma ooru, Namma ota!',
      kannada: 'ನಮ್ಮ ಊರು, ನಮ್ಮ ಓಟ!',
      meaning: 'Our city, our sprint!',
      spokenKn: 'ನಮ್ಮ ಊರು, ನಮ್ಮ ಓಟ!',
      spokenEnIn: 'Namma ooru, Namma ota!',
      pitch: 1.05,
      rate: 1.04,
    },
  ],
  kaapi: [
    {
      id: 'kaapi_oh_nodi',
      event: 'kaapi',
      romanized: 'Oh, nodi! Benki speed!',
      kannada: 'ಓಹ್, ನೋಡಿ! ಬೆಂಕಿ ಸ್ಪೀಡ್!',
      meaning: 'Look! Fiery speed!',
      spokenKn: 'ಓಹ್, ನೋಡಿ! ಬೆಂಕಿ ಸ್ಪೀಡ್!',
      spokenEnIn: 'Oh, nodi! Benki speed!',
      pitch: 1.15,
      rate: 1.12,
    },
    {
      id: 'kaapi_bisi_josh',
      event: 'kaapi',
      romanized: 'Bisi bisi kaapi, full josh!',
      kannada: 'ಬಿಸಿ ಬಿಸಿ ಕಾಫಿ, ಫುಲ್ ಜೋಶ್!',
      meaning: 'Piping hot coffee, full energy!',
      spokenKn: 'ಬಿಸಿ ಬಿಸಿ ಕಾಫಿ, ಫುಲ್ ಜೋಶ್!',
      spokenEnIn: 'Bisi bisi kaapi, full josh!',
      pitch: 1.12,
      rate: 1.1,
    },
    {
      id: 'kaapi_sakkath_guru',
      event: 'kaapi',
      romanized: 'Sakkath guru, yaaru nilsalla!',
      kannada: 'ಸಕ್ಕತ್ ಗುರು, ಯಾರೂ ನಿಲ್ಸಲ್ಲ!',
      meaning: 'Awesome guru, nobody can stop you!',
      spokenKn: 'ಸಕ್ಕತ್ ಗುರು, ಯಾರೂ ನಿಲ್ಸಲ್ಲ!',
      spokenEnIn: 'Sakkath guru, yaaru nilsalla!',
      pitch: 1.14,
      rate: 1.12,
    },
    {
      id: 'kaapi_degree_power',
      event: 'kaapi',
      romanized: 'Degree kaapi power, hogu!',
      kannada: 'ಡಿಗ್ರಿ ಕಾಫಿ ಪವರ್, ಹೋಗು!',
      meaning: 'Degree coffee power, go!',
      spokenKn: 'ಡಿಗ್ರಿ ಕಾಫಿ ಪವರ್, ಹೋಗು!',
      spokenEnIn: 'Degree kaapi power, hogu!',
      pitch: 1.1,
      rate: 1.1,
    },
  ],
  magnet: [
    {
      id: 'magnet_oh_nodi',
      event: 'magnet',
      romanized: 'Oh, nodi!',
      kannada: 'ಓಹ್, ನೋಡಿ!',
      meaning: 'Look!',
      spokenKn: 'ಓಹ್, ನೋಡಿ!',
      spokenEnIn: 'Oh, nodi!',
      pitch: 1.16,
      rate: 1.06,
    },
    {
      id: 'magnet_yella_namde',
      event: 'magnet',
      romanized: 'Yella tokens namde, guru!',
      kannada: 'ಎಲ್ಲಾ ಟೋಕನ್ಸ್ ನಮ್ಮದೇ, ಗುರು!',
      meaning: 'All the tokens are ours, guru!',
      spokenKn: 'ಎಲ್ಲಾ ಟೋಕನ್ಸ್ ನಮ್ಮದೇ, ಗುರು!',
      spokenEnIn: 'Yella tokens namde, guru!',
      pitch: 1.1,
      rate: 1.08,
    },
    {
      id: 'magnet_dosa_banni',
      event: 'magnet',
      romanized: 'Sakkath dosa magnet, banni!',
      kannada: 'ಸಕ್ಕತ್ ದೋಸೆ ಮ್ಯಾಗ್ನೆಟ್, ಬನ್ನಿ!',
      meaning: 'Awesome dosa magnet, come here!',
      spokenKn: 'ಸಕ್ಕತ್ ದೋಸೆ ಮ್ಯಾಗ್ನೆಟ್, ಬನ್ನಿ!',
      spokenEnIn: 'Sakkath dosa magnet, banni!',
      pitch: 1.12,
      rate: 1.08,
    },
    {
      id: 'magnet_baa_collection',
      event: 'magnet',
      romanized: 'Baa baa, full collection!',
      kannada: 'ಬಾ ಬಾ, ಫುಲ್ ಕಲೆಕ್ಷನ್!',
      meaning: 'Come on, full collection!',
      spokenKn: 'ಬಾ ಬಾ, ಫುಲ್ ಕಲೆಕ್ಷನ್!',
      spokenEnIn: 'Baa baa, full collection!',
      pitch: 1.14,
      rate: 1.1,
    },
  ],
  drone: [
    {
      id: 'drone_oh_nodi_haaro',
      event: 'drone',
      romanized: 'Oh, nodi! Mele haaro!',
      kannada: 'ಓಹ್, ನೋಡಿ! ಮೇಲೆ ಹಾರೋ!',
      meaning: 'Look! Fly up high!',
      spokenKn: 'ಓಹ್, ನೋಡಿ! ಮೇಲೆ ಹಾರೋ!',
      spokenEnIn: 'Oh, nodi! Mele haaro!',
      pitch: 1.16,
      rate: 1.08,
    },
    {
      id: 'drone_silk_board',
      event: 'drone',
      romanized: 'Silk Board mele haari hogu!',
      kannada: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಮೇಲೆ ಹಾರಿ ಹೋಗು!',
      meaning: 'Fly right over Silk Board!',
      spokenKn: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಮೇಲೆ ಹಾರಿ ಹೋಗು!',
      spokenEnIn: 'Silk Board mele haari hogu!',
      pitch: 1.1,
      rate: 1.08,
    },
    {
      id: 'drone_traffic_illa',
      event: 'drone',
      romanized: 'Traffic illa, sky express!',
      kannada: 'ಟ್ರಾಫಿಕ್ ಇಲ್ಲ, ಸ್ಕೈ ಎಕ್ಸ್‌ಪ್ರೆಸ್!',
      meaning: 'No traffic, sky express!',
      spokenKn: 'ಟ್ರಾಫಿಕ್ ಇಲ್ಲ, ಸ್ಕೈ ಎಕ್ಸ್‌ಪ್ರೆಸ್!',
      spokenEnIn: 'Traffic illa, sky express!',
      pitch: 1.12,
      rate: 1.06,
    },
    {
      id: 'drone_super_macha',
      event: 'drone',
      romanized: 'Super macha, full top view!',
      kannada: 'ಸೂಪರ್ ಮಚ್ಚಾ, ಫುಲ್ ಟಾಪ್ ವ್ಯೂ!',
      meaning: 'Super buddy, full top view!',
      spokenKn: 'ಸೂಪರ್ ಮಚ್ಚಾ, ಫುಲ್ ಟಾಪ್ ವ್ಯೂ!',
      spokenEnIn: 'Super macha, full top view!',
      pitch: 1.14,
      rate: 1.08,
    },
  ],
  hoverboard: [
    {
      id: 'board_oh_nodi_auto',
      event: 'hoverboard',
      romanized: 'Oh, nodi! Turbo Auto!',
      kannada: 'ಓಹ್, ನೋಡಿ! ಟರ್ಬೋ ಆಟೋ!',
      meaning: 'Look! Turbo Auto!',
      spokenKn: 'ಓಹ್, ನೋಡಿ! ಟರ್ಬೋ ಆಟೋ!',
      spokenEnIn: 'Oh, nodi! Turbo Auto!',
      pitch: 1.12,
      rate: 1.1,
    },
    {
      id: 'board_meter_down',
      event: 'hoverboard',
      romanized: 'Meter down, hogu macha!',
      kannada: 'ಮೀಟರ್ ಡೌನ್, ಹೋಗು ಮಚ್ಚಾ!',
      meaning: "Meter down, let's roll buddy!",
      spokenKn: 'ಮೀಟರ್ ಡೌನ್, ಹೋಗು ಮಚ್ಚಾ!',
      spokenEnIn: 'Meter down, hogu macha!',
      pitch: 1.08,
      rate: 1.1,
    },
    {
      id: 'board_swalpa_side',
      event: 'hoverboard',
      romanized: 'Swalpa side kodi, guru!',
      kannada: 'ಸ್ವಲ್ಪ ಸೈಡ್ ಕೊಡಿ, ಗುರು!',
      meaning: 'Make a little room, guru!',
      spokenKn: 'ಸ್ವಲ್ಪ ಸೈಡ್ ಕೊಡಿ, ಗುರು!',
      spokenEnIn: 'Swalpa side kodi, guru!',
      pitch: 1.06,
      rate: 1.08,
    },
    {
      id: 'board_auto_raja',
      event: 'hoverboard',
      romanized: 'Auto Raja bandru, nodi!',
      kannada: 'ಆಟೋ ರಾಜ ಬಂದ್ರು, ನೋಡಿ!',
      meaning: 'Auto King has arrived, look!',
      spokenKn: 'ಆಟೋ ರಾಜ ಬಂದ್ರು, ನೋಡಿ!',
      spokenEnIn: 'Auto Raja bandru, nodi!',
      pitch: 1.1,
      rate: 1.08,
    },
  ],
};

/**
 * Picks a randomized Kannada phrase for the given game event,
 * avoiding back-to-back repeats whenever the pool has >1 entries.
 */
export function pickVoiceOverPhrase(
  event: VoiceOverEvent,
  lastPhraseId?: string | null,
  rng: () => number = Math.random,
): VoiceOverPhrase {
  const pool = KANNADA_VOICE_OVER_PHRASES[event];
  const candidates =
    pool.length > 1 && lastPhraseId ? pool.filter((p) => p.id !== lastPhraseId) : pool;
  const raw = rng();
  const clamped = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0;
  const idx = Math.floor(clamped * candidates.length);
  return candidates[idx] ?? pool[0];
}

/**
 * Ranks available browser SpeechSynthesis voices for Kannada / Bengaluru delivery:
 * 1. Native Kannada (`kn-IN` / `kn`)
 * 2. Indian English (`en-IN`) — pronounces Romanized Kannada naturally
 * 3. Any English voice (`en-*`)
 * 4. Browser default or first available voice
 */
export function selectPreferredSpeechVoice<T extends SpeechVoiceDescriptor>(
  voices: readonly T[],
): T | null {
  if (!voices || voices.length === 0) return null;

  const norm = (lang: string) => lang.toLowerCase().replace('_', '-');

  const knIn = voices.find((v) => norm(v.lang) === 'kn-in');
  if (knIn) return knIn;

  const knAny = voices.find((v) => norm(v.lang).startsWith('kn'));
  if (knAny) return knAny;

  const enIn = voices.find((v) => norm(v.lang) === 'en-in');
  if (enIn) return enIn;

  const enAny = voices.find((v) => norm(v.lang).startsWith('en'));
  if (enAny) return enAny;

  return voices.find((v) => v.default) ?? voices[0];
}

/**
 * Matches spoken script to the selected voice so non-Kannada TTS engines never go
 * silent on Kannada Unicode, while true `kn-IN` voices speak native Kannada script.
 */
export function getSpeechPayload(
  phrase: VoiceOverPhrase,
  voice: SpeechVoiceDescriptor | null,
): { text: string; lang: string } {
  const langNorm = voice?.lang ? voice.lang.toLowerCase().replace('_', '-') : '';
  if (langNorm.startsWith('kn')) {
    return {
      text: phrase.spokenKn,
      lang: voice?.lang || 'kn-IN',
    };
  }
  return {
    text: phrase.spokenEnIn,
    lang: voice?.lang || 'en-IN',
  };
}
