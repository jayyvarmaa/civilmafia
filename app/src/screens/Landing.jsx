import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useGame } from '../context/GameContext';

export default function Landing() {
  const navigate = useNavigate();
  const { playerName } = useGame();

  const handleCreate = () => {
    if (!playerName) {
      navigate('/name?intent=create');
    } else {
      navigate('/create');
    }
  };

  const handleJoin = () => {
    if (!playerName) {
      navigate('/name?intent=join');
    } else {
      navigate('/join');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tighter text-brand-primary drop-shadow-md uppercase">
          Sleeper Cell
        </h1>
        <p className="text-lg text-brand-offwhite/80">
          Trust no one.
        </p>
      </div>

      <div className="flex flex-col w-full space-y-4 px-4">
        <Button size="lg" onClick={handleCreate} className="w-full">
          Create Room
        </Button>
        <Button size="lg" variant="outline" onClick={handleJoin} className="w-full">
          Join Room
        </Button>
      </div>
    </div>
  );
}
