import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useGame } from '../context/GameContext';
import { Loader2, Hash, QrCode, Camera, X } from 'lucide-react';

function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let scanner = null;
    const startScanner = async () => {
      // Browsers block camera APIs on insecure contexts (HTTP on non-localhost IPs)
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError('Camera access is blocked by your browser on insecure (HTTP) network IPs. Please scan using your system camera app instead, or type the code manually.');
        return;
      }

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Extract room code from URL like .../join?code=XXXXXXXX
            const match = decodedText.match(/[?&]code=([A-Z0-9]+)/i);
            if (match) {
              scanner.stop().catch(() => {});
              onScan(match[1].toUpperCase());
            }
          },
          () => {} // ignore errors (no QR found yet)
        );
      } catch (err) {
        console.error('[QR_SCANNER] Failed to start camera:', err);
        setError('Could not access camera. Please check camera permissions or try again.');
      }
    };
    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="space-y-3">
      <style>{`
        #qr-reader__dashboard {
          display: none !important;
        }
        #qr-reader canvas {
          display: none !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: auto !important;
          border-radius: 0.75rem;
          object-fit: cover;
        }
        #qr-reader {
          border: none !important;
        }
      `}</style>
      {error ? (
        <div className="p-4 bg-brand-primary/20 border border-brand-primary text-brand-offwhite rounded-xl text-sm leading-relaxed text-center">
          {error}
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <div id="qr-reader" ref={containerRef} className="w-full" />
        </div>
      )}
      <Button variant="ghost" onClick={onClose} className="w-full gap-2">
        <X className="h-4 w-4" /> Close Scanner
      </Button>
    </div>
  );
}

export default function JoinRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { joinRoom, playerName } = useGame();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const autoJoinAttempted = useRef(false);

  // Auto-fill code from QR scan URL param
  useEffect(() => {
    const qrCode = searchParams.get('code');
    if (qrCode) {
      setCode(qrCode.toUpperCase());
    }
  }, [searchParams]);

  // If we have a code from QR AND the user doesn't have a name yet, send them to name entry first
  useEffect(() => {
    const qrCode = searchParams.get('code');
    if (qrCode && !playerName) {
      navigate(`/name?intent=join&code=${qrCode.toUpperCase()}`, { replace: true });
    }
  }, [searchParams, playerName, navigate]);

  // Auto-join if we came back from name entry with a code AND a name
  useEffect(() => {
    const qrCode = searchParams.get('code');
    if (qrCode && playerName && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      handleAutoJoin(qrCode.toUpperCase());
    }
  }, [searchParams, playerName]);

  const handleAutoJoin = async (roomCode) => {
    setLoading(true);
    setError('');
    try {
      await joinRoom(roomCode, playerName);
      navigate(`/lobby/${roomCode}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to join room.');
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      await joinRoom(code.toUpperCase(), playerName);
      navigate(`/lobby/${code.toUpperCase()}`);
    } catch (err) {
      setError(err.message || 'Failed to join room.');
      setLoading(false);
    }
  };

  const handleQRScan = (scannedCode) => {
    setShowScanner(false);
    setCode(scannedCode);
    // Auto-join after scanning
    if (playerName) {
      setLoading(true);
      joinRoom(scannedCode, playerName)
        .then(() => navigate(`/lobby/${scannedCode}`, { replace: true }))
        .catch((err) => {
          setError(err.message || 'Failed to join room.');
          setLoading(false);
        });
    } else {
      navigate(`/name?intent=join&code=${scannedCode}`, { replace: true });
    }
  };

  // Show loading while auto-joining from QR
  if (loading && searchParams.get('code') && playerName) {
    return (
      <div className="text-center py-20">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-brand-secondary" />
        <p className="text-brand-offwhite/70">Joining room...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="flex flex-col space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-wide">Join a Game</h2>
          <p className="text-sm text-brand-offwhite/60">Enter the 8-character room code.</p>
        </div>

        {showScanner ? (
          <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
        ) : (
          <>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-offwhite/40 h-5 w-5" />
                <Input 
                  id="roomCode"
                  name="roomCode"
                  type="text" 
                  placeholder="Room Code" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-10 uppercase tracking-widest text-center font-bold text-xl"
                  maxLength={8}
                  autoFocus
                />
              </div>
              
              {error && <p className="text-brand-primary text-sm font-medium text-center">{error}</p>}
              
              <Button type="submit" className="w-full" disabled={!code.trim() || loading || code.length !== 8}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span className="sr-only">Joining...</span>
                  </>
                ) : 'Join Room'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-brand-surface text-brand-offwhite/40">OR</span>
              </div>
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={() => setShowScanner(true)}>
              <Camera className="h-5 w-5" />
              Scan QR Code
            </Button>
          </>
        )}
        
        <Button variant="ghost" onClick={() => navigate('/')} disabled={loading} className="w-full">
          Back
        </Button>
      </Card>
    </div>
  );
}
