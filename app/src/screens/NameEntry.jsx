import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useGame } from '../context/GameContext';
import { User } from 'lucide-react';
import { DecryptedText } from '../components/ui/ReactBits';

export default function NameEntry() {
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent');
  const code = searchParams.get('code'); // Room code from QR scan flow
  const navigate = useNavigate();
  const { playerName, saveName } = useGame();
  const [name, setName] = useState(playerName || '');

  useEffect(() => {
    if (playerName) {
      setName(playerName);
    }
  }, [playerName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      saveName(name.trim());
      if (intent === 'create') {
        navigate('/create');
      } else if (intent === 'join' && code) {
        // Coming from QR scan — go straight to join with the code
        navigate(`/join?code=${code}`);
      } else {
        navigate('/join');
      }
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="flex flex-col space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-wide">
            <DecryptedText text="Who are you?" />
          </h2>
          <p className="text-sm text-brand-offwhite/60">
            {code ? `Enter your name to join room ${code}` : 'Enter your name to join the game.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-offwhite/40 h-5 w-5" />
            <Input 
              id="playerName"
              name="playerName"
              type="text" 
              placeholder="Your Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              maxLength={15}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
