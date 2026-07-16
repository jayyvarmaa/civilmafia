import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './screens/Landing'
import CreateRoom from './screens/CreateRoom'
import JoinRoom from './screens/JoinRoom'
import NameEntry from './screens/NameEntry'
import Lobby from './screens/Lobby'
import { initializeAudio } from './utils/feedback'

function App() {
  useEffect(() => {
    // Unlock Web Audio API context on first user interaction
    initializeAudio();
  }, []);

  return (
    <div className="min-h-screen bg-brand-base text-brand-offwhite flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md w-full relative">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/name" element={<NameEntry />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
