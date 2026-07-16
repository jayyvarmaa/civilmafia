import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useGame } from '../context/GameContext';
import { Loader2 } from 'lucide-react';

export default function CreateRoom() {
  const navigate = useNavigate();
  const { createRoom } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    console.log('[UI_CREATE_ROOM] User clicked "Generate Room Code" button.');
    setLoading(true);
    setError('');
    try {
      // Server auto-adds host as player — no separate joinRoom needed
      const code = await createRoom();
      console.log(`[UI_CREATE_ROOM_SUCCESS] Room ${code} created. Navigating to lobby...`);
      navigate(`/lobby/${code}`);
    } catch (err) {
      console.error('[UI_CREATE_ROOM_ERROR]', err);
      setError('Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="flex flex-col space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-wide">Host a Game</h2>
          <p className="text-sm text-brand-offwhite/60">Generate a new room code for your group.</p>
        </div>

        {error && <p className="text-brand-primary text-sm font-medium">{error}</p>}

        <div className="flex flex-col space-y-3">
          <Button onClick={handleCreate} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span className="sr-only">Generating...</span>
              </>
            ) : 'Generate Room Code'}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
