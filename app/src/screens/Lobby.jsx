import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Users, Settings, Play, Loader2, Minus, Plus, Timer, Volume2, VolumeX, Infinity } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Reusable number stepper component
function Stepper({ label, value, onChange, min = 1, max = 99, disabled = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-brand-offwhite/80">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-brand-offwhite hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center font-bold text-lg tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-brand-offwhite hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Timer stepper with Unlimited toggle
function TimerStepper({ label, value, unlimited, onValueChange, onUnlimitedToggle, disabled = false }) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  const display = minutes > 0 ? `${minutes}m ${seconds > 0 ? seconds + 's' : ''}` : `${seconds}s`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-brand-offwhite/80">{label}</span>
        <button
          type="button"
          onClick={() => onUnlimitedToggle(!unlimited)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            unlimited
              ? 'bg-brand-secondary/20 text-brand-secondary'
              : 'bg-white/10 text-brand-offwhite/50 hover:bg-white/15'
          }`}
        >
          <Infinity className="h-3 w-3" />
          {unlimited ? 'Unlimited' : 'Timed'}
        </button>
      </div>
      {!unlimited && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onValueChange(Math.max(15, value - 15))}
            disabled={disabled || value <= 15}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-brand-offwhite hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-20 text-center font-bold text-lg tabular-nums">{display}</span>
          <button
            type="button"
            onClick={() => onValueChange(Math.min(600, value + 15))}
            disabled={disabled || value >= 600}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-brand-offwhite hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Lobby() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { roomState, players, isHost, playerId, updateSettings } = useGame();

  if (!roomState) {
    return (
      <div className="text-center py-20">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-brand-secondary" />
        <p className="animate-pulse text-brand-offwhite/70">Loading Room...</p>
      </div>
    );
  }

  const [localSettings, setLocalSettings] = React.useState(null);
  const debounceTimeoutRef = React.useRef(null);

  // Sync localSettings with incoming roomState updates
  useEffect(() => {
    if (roomState?.settings) {
      setLocalSettings(roomState.settings);
    }
  }, [roomState?.settings]);

  const playerList = Object.values(players || {});
  const settings = localSettings || roomState.settings || {};

  // Validate mafia count: 1 ≤ mafiaCount < totalPlayers
  const totalPlayers = settings.totalPlayers || 5;
  const mafiaCount = settings.mafiaCount || 1;
  const maxMafia = Math.max(1, totalPlayers - 1);

  const handleSettingChange = (key, value) => {
    const updated = { ...settings, [key]: value };

    // Auto-clamp mafiaCount if totalPlayers changes
    if (key === 'totalPlayers' && updated.mafiaCount >= value) {
      updated.mafiaCount = Math.max(1, value - 1);
    }

    // 1. Update UI state instantly
    setLocalSettings(updated);

    // 2. Debounce database/socket update to prevent lag
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      updateSettings(updated);
    }, 250);
  };
  
  const handleStartGame = () => {
    alert('Start Game logic coming soon!');
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 space-y-5 w-full max-w-md mx-auto">
      {/* Room Code + QR Code */}
      <Card className="text-center space-y-3 bg-brand-base border-brand-secondary/30 flex flex-col items-center justify-center">
        <h2 className="text-sm font-semibold text-brand-secondary tracking-widest uppercase">Room Code</h2>
        <div className="text-4xl font-black tracking-[0.3em] drop-shadow-sm">{roomCode}</div>
        <div className="bg-white p-3 rounded-xl shadow-lg">
          <QRCodeSVG value={`${window.location.origin}/join?code=${roomCode}`} size={120} />
        </div>
        <p className="text-xs text-brand-offwhite/50">Scan to join the game</p>
      </Card>

      {/* Players List */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Players ({playerList.length})
          </h3>
        </div>
        
        <div className="space-y-2 max-h-[25vh] overflow-y-auto">
          {playerList.length === 0 ? (
            <p className="text-brand-offwhite/50 text-sm text-center py-4">Waiting for players...</p>
          ) : (
            playerList.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="font-medium">{p.name}</span>
                {p.isHost && (
                  <span className="text-xs bg-brand-secondary/20 text-brand-secondary px-2 py-1 rounded-full uppercase font-bold tracking-wider">
                    Host
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Host Controls or Waiting Message */}
      {isHost ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" /> Game Settings
            </h3>
          </div>

          <div className="space-y-4">
            {/* Total Players */}
            <Stepper
              label="Total Players"
              value={totalPlayers}
              onChange={(v) => handleSettingChange('totalPlayers', v)}
              min={2}
              max={20}
            />

            {/* Mafia Count */}
            <Stepper
              label="Mafia Count"
              value={mafiaCount}
              onChange={(v) => handleSettingChange('mafiaCount', v)}
              min={1}
              max={maxMafia}
            />

            <div className="border-t border-white/10 pt-3 space-y-3">
              {/* Discussion Timer */}
              <TimerStepper
                label="Discussion Timer"
                value={settings.discussionSeconds || 120}
                unlimited={settings.discussionUnlimited || false}
                onValueChange={(v) => handleSettingChange('discussionSeconds', v)}
                onUnlimitedToggle={(v) => handleSettingChange('discussionUnlimited', v)}
              />

              {/* Voting Timer */}
              <TimerStepper
                label="Voting Timer"
                value={settings.votingSeconds || 60}
                unlimited={settings.votingUnlimited || false}
                onValueChange={(v) => handleSettingChange('votingSeconds', v)}
                onUnlimitedToggle={(v) => handleSettingChange('votingUnlimited', v)}
              />
            </div>

            {/* Sound Effects */}
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-brand-offwhite/80">Sound Effects</span>
                <button
                  type="button"
                  onClick={() => handleSettingChange('soundEnabled', !settings.soundEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    settings.soundEnabled
                      ? 'bg-brand-secondary/20 text-brand-secondary'
                      : 'bg-white/10 text-brand-offwhite/50 hover:bg-white/15'
                  }`}
                >
                  {settings.soundEnabled ? (
                    <><Volume2 className="h-3.5 w-3.5" /> On</>
                  ) : (
                    <><VolumeX className="h-3.5 w-3.5" /> Off</>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <Button onClick={handleStartGame} className="w-full gap-2" size="lg">
            <Play className="h-5 w-5" /> Start Game
          </Button>
        </Card>
      ) : (
        <Card className="text-center p-6">
          <Loader2 className="animate-spin h-6 w-6 mx-auto mb-3 text-brand-secondary" />
          <p className="text-brand-offwhite/80 font-medium">Waiting for Host to start...</p>
        </Card>
      )}
    </div>
  );
}
