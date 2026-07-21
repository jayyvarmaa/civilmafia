import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  Users, Settings, Play, Loader2, Minus, Plus, Timer, 
  Volume2, VolumeX, Infinity, Eye, EyeOff, Skull, 
  AlertTriangle, Award, RefreshCw, LogOut, CheckCircle, WifiOff 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { playSound, triggerVibrate } from '../utils/feedback';
import { DecryptedText, ShinyText } from '../components/ui/ReactBits';

// --- Stylized Initials Avatar Component ---

const getAvatarColor = (name) => {
  const colors = [
    'from-red-500 to-red-600',
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-yellow-500 to-yellow-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600',
    'from-teal-500 to-teal-600'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const color = getAvatarColor(name || '');
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-black text-sm shadow-md border border-white/10`}>
      {initials}
    </div>
  );
}

// --- Sub-components for Settings ---

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

// Live Countdown Timer hook/renderer with tick audio
function ActiveTimer({ targetTime, label = "Time Remaining", soundEnabled = true }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!targetTime) return;
    
    const calculateTime = () => {
      const difference = new Date(targetTime).getTime() - Date.now();
      return Math.max(0, Math.ceil(difference / 1000));
    };

    setTimeLeft(calculateTime());

    const interval = setInterval(() => {
      const remaining = calculateTime();
      setTimeLeft(remaining);
      
      // Play a countdown tick sound on the last 5 seconds
      if (remaining > 0 && remaining <= 5) {
        playSound('tick', soundEnabled);
        triggerVibrate(30);
      }

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, soundEnabled]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="text-center space-y-1">
      <span className="text-xs uppercase tracking-widest text-brand-offwhite/50">{label}</span>
      <div className={`text-4xl font-mono font-black tracking-wider ${timeLeft <= 5 ? 'text-brand-primary animate-pulse' : 'text-brand-secondary'}`}>
        {formattedTime}
      </div>
    </div>
  );
}

// --- Dynamic Phase Views ---

function LobbyPhase({ roomCode, playerList, isHost, playerId, kickPlayer, settings, totalPlayers, mafiaCount, maxMafia, handleSettingChange, startGame }) {
  return (
    <div className="space-y-5 animate-in fade-in zoom-in duration-300">
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
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5 animate-in slide-in-from-bottom duration-300">
                <span className="font-semibold">{p.name}</span>
                <div className="flex items-center gap-2">
                  {p.isHost && (
                    <span className="text-xs bg-brand-secondary/20 text-brand-secondary px-2 py-1 rounded-full uppercase font-bold tracking-wider">
                      Host
                    </span>
                  )}
                  {isHost && !p.isHost && (
                    <button
                      onClick={() => kickPlayer(p.player_id)}
                      className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                      title="Kick Player"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Settings / Controls */}
      {isHost ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" /> Game Settings
            </h3>
          </div>

          <div className="space-y-4">
            <Stepper
              label="Mafia Count"
              value={mafiaCount}
              onChange={(v) => handleSettingChange('mafiaCount', v)}
              min={1}
              max={maxMafia}
            />

            <div className="border-t border-white/10 pt-3 space-y-3">
              <TimerStepper
                label="Discussion Timer"
                value={settings.discussionSeconds || 120}
                unlimited={settings.discussionUnlimited || false}
                onValueChange={(v) => handleSettingChange('discussionSeconds', v)}
                onUnlimitedToggle={(v) => handleSettingChange('discussionUnlimited', v)}
              />

              <TimerStepper
                label="Voting Timer"
                value={settings.votingSeconds || 60}
                unlimited={settings.votingUnlimited || false}
                onValueChange={(v) => handleSettingChange('votingSeconds', v)}
                onUnlimitedToggle={(v) => handleSettingChange('votingUnlimited', v)}
              />
            </div>

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
          
          <Button onClick={startGame} className="w-full gap-2" size="lg">
            <Play className="h-5 w-5" /> Start Game
          </Button>
        </Card>
      ) : (
        <Card className="text-center p-6 bg-brand-surface border border-white/5">
          <Loader2 className="animate-spin h-6 w-6 mx-auto mb-3 text-brand-secondary" />
          <p className="text-brand-offwhite/80 font-medium">Waiting for Host to start...</p>
        </Card>
      )}
    </div>
  );
}

function CountdownPhase() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <Card className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-300">
      <h2 className="text-xl uppercase tracking-widest text-brand-offwhite/60">
        <DecryptedText text="Game Starting" />
      </h2>
      <div className="text-8xl font-black font-mono text-brand-secondary animate-bounce">
        {count > 0 ? count : 'GO!'}
      </div>
      <p className="text-sm text-brand-offwhite/40">Prepare your poker face...</p>
    </Card>
  );
}

function RevealPhase({ roomState, playerId, players, isHost, advancePhase }) {
  const self = players[playerId] || {};
  const isMafia = self.role === 'mafia';
  // Default to false so the user is forced to tap, guaranteeing audio unlock on mobile
  const [showRole, setShowRole] = useState(false);
  const [hasPlayedRoleAudio, setHasPlayedRoleAudio] = useState(false);

  const fellowMafia = Object.entries(players)
    .filter(([id, p]) => id !== playerId && p.role === 'mafia')
    .map(([_, p]) => p.name);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Card className="flex flex-col items-center justify-center py-10 space-y-6 text-center relative overflow-hidden min-h-[300px]">
        {showRole ? (
          <div className="space-y-6 animate-in fade-in duration-300 w-full px-4">
            <h2 className="text-2xl font-bold uppercase tracking-wide">
              <DecryptedText text="You Are A" />
            </h2>
            
            {isMafia ? (
              <div className="space-y-4">
                <div className="text-5xl font-black text-brand-primary tracking-wide uppercase drop-shadow-md">
                  Mafia
                </div>
                {fellowMafia.length > 0 ? (
                  <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-sm">
                    <p className="text-brand-offwhite/60 mb-1">Your partners-in-crime:</p>
                    <p className="font-bold text-brand-primary text-base">{fellowMafia.join(', ')}</p>
                  </div>
                ) : (
                  <p className="text-sm text-brand-offwhite/50">You are the lone wolf.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl font-black text-brand-secondary tracking-wide uppercase drop-shadow-md">
                  Civilian
                </div>
                <div className="p-3 bg-brand-secondary/10 border border-brand-secondary/20 rounded-xl text-sm">
                  <p className="text-brand-offwhite/60">Find the hidden mafia and vote them out.</p>
                </div>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={() => setShowRole(false)} className="gap-2 mx-auto">
              <EyeOff className="h-4 w-4" /> Hide Role
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold uppercase tracking-wide">
              <DecryptedText text="Your Secret Role" />
            </h2>
            <button
              onClick={() => {
                setShowRole(true);
                triggerVibrate(isMafia ? [200, 100, 200] : [100, 50, 100]);
                if (!hasPlayedRoleAudio) {
                  playSound('reveal', roomState.settings?.soundEnabled);
                  setHasPlayedRoleAudio(true);
                }
              }}
              className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-secondary hover:bg-white/10 transition-all active:scale-95 shadow-lg"
            >
              <Eye className="h-10 w-10" />
            </button>
            <p className="text-xs text-brand-offwhite/50 max-w-[200px]">
              Tap card to view your role again.
            </p>
          </>
        )}
      </Card>

      {isHost ? (
        <Button onClick={() => advancePhase('discussion')} className="w-full gap-2" size="lg">
          <Play className="h-5 w-5" /> Begin Discussion
        </Button>
      ) : (
        <Card className="text-center p-4">
          <p className="text-sm text-brand-offwhite/70 animate-pulse">
            Waiting for Host to begin the discussion...
          </p>
        </Card>
      )}
    </div>
  );
}

function DiscussionPhase({ roomState, isHost, advancePhase }) {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Card className="text-center p-6 space-y-4">
        <h2 className="text-sm font-semibold text-brand-secondary tracking-widest uppercase">
          <DecryptedText text={`Round ${(roomState.current_round || 0) + 1} Discussion`} />
        </h2>
        
        {roomState.settings?.discussionUnlimited ? (
          <div className="space-y-2 py-4">
            <Infinity className="h-10 w-10 mx-auto text-brand-secondary" />
            <p className="font-semibold text-xl">Unlimited Discussion</p>
            <p className="text-xs text-brand-offwhite/50">Talk in person. Host will trigger voting when ready.</p>
          </div>
        ) : (
          <ActiveTimer 
            targetTime={roomState.discussion_ends_at} 
            label="Discussion Ends In" 
            soundEnabled={roomState.settings?.soundEnabled}
          />
        )}
      </Card>

      {isHost ? (
        <Button onClick={() => advancePhase('voting')} className="w-full gap-2" size="lg">
          <Play className="h-5 w-5" /> Begin Voting
        </Button>
      ) : (
        <Card className="text-center p-4">
          <p className="text-sm text-brand-offwhite/70 animate-pulse">
            Discuss in person. Voting will start shortly.
          </p>
        </Card>
      )}
    </div>
  );
}

function VotingPhase({ roomState, playerId, players, isHost, castVote, endVoting }) {
  const self = players[playerId] || {};
  const isSelfAlive = self.isAlive !== false;
  
  const playerList = Object.entries(players).map(([id, p]) => ({ id, ...p }));
  const voteTallies = {};
  playerList.forEach(p => { if (p.isAlive !== false) voteTallies[p.id] = 0; });
  playerList.forEach(p => {
    if (p.isAlive !== false && p.votedFor && voteTallies[p.votedFor] !== undefined) {
      voteTallies[p.votedFor]++;
    }
  });

  const totalVotesCast = playerList.filter(p => p.isAlive !== false && p.hasVoted).length;
  const totalLivingPlayers = playerList.filter(p => p.isAlive !== false).length;

  const handleCastVote = (targetId) => {
    // Play short arpeggio click and trigger haptic
    playSound('vote', roomState.settings?.soundEnabled);
    triggerVibrate(40);
    castVote(targetId);
  };

  return (
    <div className="space-y-5 animate-in fade-in zoom-in duration-300">
      <Card className="text-center p-4 space-y-2">
        <h2 className="text-sm font-semibold text-brand-secondary tracking-widest uppercase">
          <DecryptedText text={`Round ${(roomState.current_round || 0) + 1} Voting`} />
        </h2>
        {roomState.settings?.votingUnlimited ? (
          <p className="text-xs text-brand-offwhite/50">Host will resolve voting manually.</p>
        ) : (
          <ActiveTimer 
            targetTime={roomState.voting_ends_at} 
            label="Voting Ends In" 
            soundEnabled={roomState.settings?.soundEnabled}
          />
        )}
        <div className="text-sm font-bold text-brand-secondary">
          Votes Cast: {totalVotesCast} / {totalLivingPlayers}
        </div>
      </Card>

      {/* Player Selection Cards */}
      <div className="space-y-2">
        {playerList
          .filter(p => p.isAlive !== false)
          .map((p, idx) => {
            const hasVotedForThis = self.votedFor === p.id;
            const isSelf = p.id === playerId;
            const hasVotedCheck = p.hasVoted;

            return (
              <div 
                key={idx} 
                className={`flex items-center justify-between rounded-xl p-3 border transition-all animate-in slide-in-from-bottom duration-300 ${
                  hasVotedForThis 
                    ? 'bg-brand-primary/10 border-brand-primary' 
                    : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-center">
                  <div className="flex flex-col">
                    <span className="font-semibold text-lg flex items-center gap-1.5">
                      {p.name} {isSelf && "(You)"}
                      {hasVotedCheck && (
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 bg-brand-secondary/20 text-brand-secondary rounded-full tracking-wide">
                          Voted
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                
                {isSelfAlive && !isSelf && (
                  <Button
                    size="sm"
                    variant={hasVotedForThis ? "danger" : "outline"}
                    onClick={() => handleCastVote(hasVotedForThis ? null : p.id)}
                  >
                    {hasVotedForThis ? 'Voted' : 'Vote'}
                  </Button>
                )}
              </div>
            );
          })}
      </div>

      {/* Dead Players Spectating list */}
      {playerList.some(p => p.isAlive === false) && (
        <Card className="p-3 space-y-2 bg-black/10 border-white/5">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-offwhite/40">
            Eliminated Spectators
          </span>
          <div className="flex flex-wrap gap-2">
            {playerList
              .filter(p => p.isAlive === false)
              .map((p, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full text-xs text-brand-offwhite/50 border border-white/5">
                  <Skull className="h-3 w-3 text-brand-primary" />
                  <span className="line-through">{p.name}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Host early resolution button */}
      {isHost && (
        <Button onClick={endVoting} className="w-full gap-2" size="lg">
          <CheckCircle className="h-5 w-5" /> End Voting & Tally
        </Button>
      )}
    </div>
  );
}

function EliminationRevealPhase({ roomState, playerId, players, isHost, advancePhase }) {
  const lastElimination = roomState.eliminationHistory?.[roomState.eliminationHistory.length - 1];
  const eliminatedPlayer = lastElimination ? players[lastElimination.eliminated_player_id] : null;

  // Trigger elimination sound on render
  useEffect(() => {
    if (lastElimination) {
      playSound('elimination', roomState.settings?.soundEnabled);
      triggerVibrate([300, 100, 300]);
    }
  }, [lastElimination]);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Card className="text-center py-10 space-y-6 flex flex-col items-center justify-center">
        {lastElimination ? (
          <>
            <Skull className="h-16 w-16 text-brand-primary animate-pulse" />
            <div className="space-y-2">
              {lastElimination.was_tie && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-full text-xs font-bold uppercase tracking-wider mx-auto w-fit">
                  <AlertTriangle className="h-3 w-3" /> Tie Broken by Fate
                </div>
              )}
              <h2 className="text-3xl font-black uppercase tracking-wider text-brand-offwhite">
                {eliminatedPlayer?.name || 'Someone'}
              </h2>
              <p className="text-sm text-brand-offwhite/60">has been eliminated from the cell.</p>
            </div>
            
            <div className="border-t border-white/10 w-full pt-4 space-y-1">
              <span className="text-xs uppercase tracking-widest text-brand-offwhite/40">Their role was</span>
              <p className={`text-2xl font-black uppercase ${lastElimination.eliminated_role === 'mafia' ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                {lastElimination.eliminated_role}
              </p>
            </div>
          </>
        ) : (
          <p className="text-brand-offwhite/50">No one was eliminated this round.</p>
        )}
      </Card>

      {isHost ? (
        <Button onClick={() => advancePhase('discussion')} className="w-full gap-2" size="lg">
          <Play className="h-5 w-5" /> Begin Next Round
        </Button>
      ) : (
        <Card className="text-center p-4">
          <p className="text-sm text-brand-offwhite/70 animate-pulse">
            Waiting for Host to start the next round...
          </p>
        </Card>
      )}
    </div>
  );
}

function GameOverPhase({ roomState, isHost, players, resetGame }) {
  const navigate = useNavigate();
  const playerList = Object.values(players || {});
  const isCivWin = roomState.winner === 'civilians';
  const wonText = isCivWin ? 'Civilians Win' : 'Mafia';

  // Trigger arpeggio on render
  useEffect(() => {
    playSound('win', roomState.settings?.soundEnabled);
    triggerVibrate([100, 50, 100, 50, 300]);
  }, [roomState.winner]);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Card className="text-center py-10 space-y-4 flex flex-col items-center justify-center">
        <Award className={`h-16 w-16 animate-bounce ${isCivWin ? 'text-brand-secondary' : 'text-brand-primary'}`} />
        <h2 className={`text-5xl font-black uppercase tracking-wide drop-shadow-md animate-pulse ${isCivWin ? 'text-brand-secondary' : 'text-brand-primary'}`}>
          {wonText}
        </h2>
        <p className="text-xs text-brand-offwhite/50">Game Over — Roles Revealed</p>
      </Card>

      {/* Players List Recap */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold border-b border-white/10 pb-2 text-sm uppercase tracking-wider text-brand-offwhite/70">
          Players
        </h3>
        <div className="space-y-2">
          {playerList.map((p, idx) => (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${p.isAlive ? 'bg-white/10 border-white/20' : 'bg-red-500/10 border-red-500/20'} animate-in slide-in-from-bottom duration-300`}>
              <div className="flex flex-col">
                <span className="font-semibold">{p.name}</span>
                <span className={`text-xs uppercase tracking-wider font-bold ${p.role === 'mafia' ? 'text-brand-primary' : 'text-brand-offwhite/60'}`}>
                  {p.role === 'mafia' ? 'Mafia' : 'Civilian'}
                </span>
              </div>
              <span className={`text-xs uppercase tracking-wider font-bold ${p.isAlive ? 'text-green-400' : 'text-red-400'}`}>
                {p.isAlive ? 'Alive' : 'Eliminated'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Host Controls */}
      {isHost ? (
        <div className="flex flex-col space-y-3">
          <Button onClick={resetGame} className="w-full gap-2" size="lg">
            <RefreshCw className="h-5 w-5" /> Play Again
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="w-full gap-2">
            <LogOut className="h-5 w-5" /> End Session
          </Button>
        </div>
      ) : (
        <Card className="text-center p-4">
          <p className="text-sm text-brand-offwhite/70 animate-pulse">
            Waiting for Host to start a new game...
          </p>
        </Card>
      )}
    </div>
  );
}

// --- Main Router ---

export default function Lobby() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { 
    roomState, players, isHost, playerId, updateSettings, 
    startGame, advancePhase, castVote, endVoting, resetGame,
    kickPlayer, socketConnected, joinRoom, setRoomCode
  } = useGame();

  const [localSettings, setLocalSettings] = React.useState(null);
  const debounceTimeoutRef = React.useRef(null);
  const hasAttemptedJoin = React.useRef(false);

  // Auto-rejoin if page is reloaded and state is lost
  useEffect(() => {
    if (!roomState && playerId && roomCode && !hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true;
      setRoomCode(roomCode); // Ensure socket attempts to join even if fetch fails
      joinRoom(roomCode).catch((err) => {
        if (err.message === 'Room not found') {
          navigate('/join');
        }
        // If it's a network error, we rely on the socket auto-reconnect to restore state
      });
    }
  }, [roomState, playerId, roomCode, joinRoom, navigate, setRoomCode]);

  // Sync localSettings with incoming roomState updates
  useEffect(() => {
    if (roomState?.settings) {
      setLocalSettings(roomState.settings);
    }
  }, [roomState?.settings]);

  if (!roomState) {
    return (
      <div className="text-center py-20">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-brand-secondary" />
        <p className="animate-pulse text-brand-offwhite/70">Loading Room...</p>
      </div>
    );
  }

  const playerList = Object.values(players || {});
  const settings = localSettings || roomState.settings || {};

  const totalPlayers = playerList.length;
  const maxMafia = Math.max(1, totalPlayers - 1);
  const mafiaCount = Math.min(settings.mafiaCount || 1, maxMafia);

  const handleSettingChange = (key, value) => {
    const updated = { ...settings, [key]: value };

    setLocalSettings(updated);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      updateSettings(updated);
    }, 250);
  };

  const showHostHeader = isHost && roomState.phase !== 'lobby';

  return (
    <div className="relative space-y-4">
      {/* ⚠️ Full Screen overlay when socket disconnects */}
      {!socketConnected && (
        <div className="fixed inset-0 bg-brand-base/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
          <WifiOff className="h-16 w-16 text-brand-primary animate-bounce" />
          <div className="space-y-1">
            <h2 className="text-2xl font-bold uppercase tracking-wide text-brand-offwhite">
              Connection Lost
            </h2>
            <p className="text-sm text-brand-offwhite/60 max-w-[250px]">
              Reconnecting to game server... Your seat and role are saved.
            </p>
          </div>
        </div>
      )}

      {/* 🛠️ Persistent Host Control Header */}
      {showHostHeader && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3 animate-in slide-in-from-top duration-300">
          <span className="text-xs font-black text-brand-secondary tracking-widest uppercase">
            Host Controls
          </span>
          <div className="flex gap-2">
            <button
              onClick={resetGame}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 text-xs font-bold text-brand-offwhite hover:bg-white/10 border border-white/5 flex items-center gap-1 active:scale-95 transition-all"
            >
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-2.5 py-1.5 rounded-lg bg-brand-primary/20 text-xs font-bold text-brand-primary hover:bg-brand-primary/30 border border-brand-primary/10 flex items-center gap-1 active:scale-95 transition-all"
            >
              <LogOut className="h-3 w-3" /> Exit
            </button>
          </div>
        </div>
      )}

      {/* Render phase content */}
      {(() => {
        switch (roomState.phase) {
          case 'countdown':
            return <CountdownPhase />;
          case 'reveal':
            return (
              <RevealPhase 
                roomState={roomState} 
                playerId={playerId} 
                players={players} 
                isHost={isHost} 
                advancePhase={advancePhase} 
              />
            );
          case 'discussion':
            return (
              <DiscussionPhase 
                roomState={roomState} 
                isHost={isHost} 
                advancePhase={advancePhase} 
              />
            );
          case 'voting':
            return (
              <VotingPhase 
                roomState={roomState} 
                playerId={playerId} 
                players={players} 
                isHost={isHost} 
                castVote={castVote} 
                endVoting={endVoting} 
              />
            );
          case 'elimination_reveal':
            return (
              <EliminationRevealPhase 
                roomState={roomState} 
                playerId={playerId} 
                players={players} 
                isHost={isHost} 
                advancePhase={advancePhase} 
              />
            );
          case 'game_over':
            return (
              <GameOverPhase 
                roomState={roomState} 
                isHost={isHost} 
                players={players} 
                resetGame={resetGame} 
              />
            );
          case 'lobby':
          default:
            return (
              <LobbyPhase 
                roomCode={roomCode}
                playerList={playerList}
                isHost={isHost}
                playerId={playerId}
                kickPlayer={kickPlayer}
                settings={settings}
                totalPlayers={totalPlayers}
                mafiaCount={mafiaCount}
                maxMafia={maxMafia}
                handleSettingChange={handleSettingChange}
                startGame={startGame}
              />
            );
        }
      })()}
    </div>
  );
}
