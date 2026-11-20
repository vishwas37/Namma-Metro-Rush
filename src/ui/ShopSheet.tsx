import React from 'react';
import { Check, Lock, X, Zap, Trophy } from 'lucide-react';
import {
  CHARACTERS,
  HOVERBOARDS,
  UPGRADES,
  type CharacterId,
  type HoverboardId,
  type PlayerProfile,
  type UpgradeKey,
} from '../core/catalog';
import {
  getEffectiveMultiplier,
  getPowerUpDuration,
  getUpgradeCost,
} from '../core/simulation';
import {
  AutoBoardIcon,
  DosaMagnetIcon,
  DroneIcon,
  KaapiIcon,
  MetroTokenIcon,
} from './Icons';

export type ShopTab = 'characters' | 'hoverboards' | 'upgrades' | 'missions';

interface ShopSheetProps {
  profile: PlayerProfile;
  tab: ShopTab;
  onChangeTab: (tab: ShopTab) => void;
  onClose: () => void;
  onSelectOrBuyCharacter: (id: CharacterId) => void;
  onSelectOrBuyHoverboard: (id: HoverboardId) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
}

export function ShopSheet({
  profile,
  tab,
  onChangeTab,
  onClose,
  onSelectOrBuyCharacter,
  onSelectOrBuyHoverboard,
  onBuyUpgrade,
}: ShopSheetProps) {
  const multiplier = getEffectiveMultiplier(profile);

  const tabs: Array<{ id: ShopTab; label: string }> = [
    { id: 'characters', label: 'Runners' },
    { id: 'hoverboards', label: 'Boards' },
    { id: 'upgrades', label: 'Upgrades' },
    { id: 'missions', label: 'Missions' },
  ];

  const upgradeIcon = (key: UpgradeKey) => {
    if (key === 'kaapi') return <KaapiIcon className="w-7 h-7" />;
    if (key === 'magnet') return <DosaMagnetIcon className="w-7 h-7" />;
    if (key === 'drone') return <DroneIcon className="w-7 h-7" />;
    return <AutoBoardIcon className="w-7 h-7" />;
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#1A1423]/78 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#211830] border-t-4 sm:border-4 border-[#1A1423] shadow-[0_-6px_28px_rgba(0,0,0,0.55)] text-white safe-bottom-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-11 h-1.5 rounded-full bg-white/25" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-2 sm:pt-4 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-[#FFD60A] tracking-wide leading-tight">
              NAMMA METRO DEPOT
            </h2>
            <p className="text-xs text-white/70">
              Tier {profile.missionTier} · Score Multiplier x{multiplier}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1423] border-2 border-[#FFD60A]">
              <MetroTokenIcon className="w-4 h-4 shrink-0" />
              <span className="font-display text-sm sm:text-base text-[#FFD60A] tabular-nums">
                {profile.tokens.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Shop"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1A1423] hover:bg-[#312349] text-white border-2 border-white/20 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="grid grid-cols-4 gap-1.5 px-4 sm:px-5 py-2.5 bg-[#191224]">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTab(t.id)}
                className={`min-h-[42px] px-2 rounded-xl font-display text-xs sm:text-sm tracking-wide border-2 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#7B2CBF] text-white border-[#FFD60A] shadow-[0_2px_0_#1A1423]'
                    : 'bg-[#261C38] text-white/75 border-transparent hover:text-white'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Area — touch-action: pan-y ensures buttery mobile scrolling */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5"
          style={{ touchAction: 'pan-y' }}
        >
          {tab === 'characters' &&
            CHARACTERS.map((char) => {
              const unlocked = profile.unlockedCharacters.includes(char.id);
              const selected = profile.selectedCharacter === char.id;
              const canAfford = profile.tokens >= char.cost;

              return (
                <div
                  key={char.id}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                    selected
                      ? 'bg-[#2E1F47] border-[#FFD60A]'
                      : 'bg-[#191224] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-[#1A1423] shrink-0 flex items-center justify-center font-display text-lg text-white shadow-[0_3px_0_#1A1423]"
                      style={{ backgroundColor: char.accentHex }}
                    >
                      {char.shortName.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm sm:text-base text-white truncate">
                        {char.name}
                      </div>
                      <div className="text-xs text-white/70 leading-snug">
                        {char.tagline}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectOrBuyCharacter(char.id)}
                    disabled={!unlocked && !canAfford}
                    className={`shrink-0 min-h-[44px] min-w-[92px] px-3 py-2 rounded-xl font-display text-xs sm:text-sm border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] flex items-center justify-center gap-1.5 cursor-pointer ${
                      selected
                        ? 'bg-[#2DC653] text-[#1A1423]'
                        : unlocked
                          ? 'bg-[#FFD60A] text-[#1A1423]'
                          : canAfford
                            ? 'bg-[#7B2CBF] text-white'
                            : 'bg-white/10 text-white/45 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ACTIVE</span>
                      </>
                    ) : unlocked ? (
                      <span>EQUIP</span>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>{char.cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'hoverboards' &&
            HOVERBOARDS.map((board) => {
              const unlocked = profile.unlockedHoverboards.includes(board.id);
              const selected = profile.selectedHoverboard === board.id;
              const canAfford = profile.tokens >= board.cost;

              return (
                <div
                  key={board.id}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                    selected
                      ? 'bg-[#2E1F47] border-[#FFD60A]'
                      : 'bg-[#191224] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-[#1A1423] shrink-0 flex items-center justify-center shadow-[0_3px_0_#1A1423]"
                      style={{ backgroundColor: board.accentHex }}
                    >
                      <AutoBoardIcon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm sm:text-base text-white truncate">
                        {board.name}
                      </div>
                      <div className="text-xs text-white/70 leading-snug">
                        {board.tagline}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectOrBuyHoverboard(board.id)}
                    disabled={!unlocked && !canAfford}
                    className={`shrink-0 min-h-[44px] min-w-[92px] px-3 py-2 rounded-xl font-display text-xs sm:text-sm border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] flex items-center justify-center gap-1.5 cursor-pointer ${
                      selected
                        ? 'bg-[#2DC653] text-[#1A1423]'
                        : unlocked
                          ? 'bg-[#FFD60A] text-[#1A1423]'
                          : canAfford
                            ? 'bg-[#7B2CBF] text-white'
                            : 'bg-white/10 text-white/45 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ACTIVE</span>
                      </>
                    ) : unlocked ? (
                      <span>EQUIP</span>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>{board.cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'upgrades' &&
            UPGRADES.map((up) => {
              const level = profile.upgrades[up.key] ?? 1;
              const cost = getUpgradeCost(profile, up.key);
              const duration = getPowerUpDuration(profile, up.key);
              const canAfford = cost !== null && profile.tokens >= cost;

              return (
                <div
                  key={up.key}
                  className="p-3 rounded-2xl bg-[#191224] border-2 border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#2A1E40] border-2 border-white/15 shrink-0 flex items-center justify-center">
                      {upgradeIcon(up.key)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm sm:text-base text-white truncate">
                        {up.name}
                      </div>
                      <div className="text-xs text-white/70 leading-snug">
                        {up.description} · {duration.toFixed(1)}s
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {Array.from({ length: up.maxLevel }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-1.5 w-5 rounded-full ${
                              idx < level ? 'bg-[#2DC653]' : 'bg-white/15'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onBuyUpgrade(up.key)}
                    disabled={cost === null || !canAfford}
                    className={`shrink-0 min-h-[44px] min-w-[92px] px-3 py-2 rounded-xl font-display text-xs sm:text-sm border-2 border-[#1A1423] shadow-[0_3px_0_#1A1423] flex items-center justify-center gap-1 cursor-pointer ${
                      cost === null
                        ? 'bg-[#2DC653]/25 text-[#2DC653] border-[#2DC653]/40 shadow-none cursor-default'
                        : canAfford
                          ? 'bg-[#FFD60A] text-[#1A1423]'
                          : 'bg-white/10 text-white/45 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {cost === null ? (
                      <span>MAX</span>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>{cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'missions' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-[#2E1F47] border-2 border-[#7B2CBF] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-6 h-6 text-[#FFD60A] shrink-0" />
                  <div>
                    <div className="font-display text-sm text-[#FFD60A]">
                      TIER {profile.missionTier} MISSIONS
                    </div>
                    <div className="text-xs text-white/80">
                      Finish all 3 to boost your score multiplier to x{multiplier + 1}!
                    </div>
                  </div>
                </div>
              </div>

              {profile.missions.map((m) => {
                const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border-2 ${
                      m.completed
                        ? 'bg-[#163124] border-[#2DC653]'
                        : 'bg-[#191224] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm text-white">{m.label}</span>
                      <span className="shrink-0 flex items-center gap-1 text-xs font-display text-[#FFD60A]">
                        +{m.rewardTokens}
                        <MetroTokenIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.completed ? 'bg-[#2DC653]' : 'bg-[#FFD60A]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/70 mt-1 tabular-nums">
                      <span>{m.completed ? 'COMPLETED!' : `${m.progress} / ${m.target}`}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
