import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 1. ShinyText - Metallic reflection sweeping effect
export function ShinyText({ text, disabled = false, speed = 2, className = "" }) {
  const animationStyle = {
    animationDuration: `${speed}s`,
  };

  return (
    <span
      style={animationStyle}
      className={`inline-block bg-gradient-to-r from-brand-offwhite via-brand-secondary to-brand-offwhite bg-[length:200%_auto] bg-clip-text text-transparent ${
        disabled ? '' : 'animate-shiny-text'
      } ${className}`}
    >
      {text}
    </span>
  );
}

// 2. DecryptedText - Cyberpunk letter-scrambling arpeggio aright to correct text
export function DecryptedText({ 
  text, 
  speed = 40, 
  maxIterations = 10, 
  className = "" 
}) {
  const [displayText, setDisplayText] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-';

  useEffect(() => {
    let iteration = 0;
    let interval = null;

    interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }
      iteration += text.length / maxIterations;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, maxIterations]);

  return <span className={className}>{displayText}</span>;
}

// 3. SplitText - Sequential letter-by-letter entrance
export function SplitText({ text, delay = 0.05, className = "" }) {
  const letters = text.split("");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 12, stiffness: 200 },
    },
  };

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`inline-block ${className}`}
    >
      {letters.map((letter, idx) => (
        <motion.span
          key={idx}
          variants={letterVariants}
          className="inline-block"
          style={{ whiteSpace: letter === " " ? "pre" : "normal" }}
        >
          {letter}
        </motion.span>
      ))}
    </motion.span>
  );
}

// 4. AsciiText - Lightweight custom ASCII typography reacting to mobile gyroscope
export function AsciiText({ text = "ASCII", className = "" }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleOrientation = (e) => {
      // Gamma is the left-to-right tilt in degrees, where right is positive
      // Beta is the front-to-back tilt in degrees, where front is positive
      const gamma = e.gamma || 0;
      const beta = e.beta || 0;

      // Limit the tilt values to reasonable ranges
      const tiltX = Math.max(-45, Math.min(45, gamma));
      const tiltY = Math.max(-45, Math.min(45, beta));

      // Map tilt to a CSS pixel offset (e.g. max 15px shift)
      const x = (tiltX / 45) * 15;
      const y = (tiltY / 45) * 15;

      setOffset({ x, y });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Base Layer */}
      <div className="text-brand-offwhite opacity-20 filter blur-[2px] pointer-events-none absolute inset-0">
        {text}
      </div>
      {/* Glitch / Offset Layer 1 */}
      <div
        className="absolute inset-0 text-brand-secondary opacity-70 pointer-events-none mix-blend-screen font-black tracking-widest drop-shadow-[0_0_10px_rgba(255,169,2,0.8)]"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {text}
      </div>
      {/* Glitch / Offset Layer 2 */}
      <div
        className="absolute inset-0 text-brand-primary opacity-70 pointer-events-none mix-blend-screen font-black tracking-widest drop-shadow-[0_0_10px_rgba(201,5,17,0.8)]"
        style={{ transform: `translate(${-offset.x}px, ${-offset.y}px)` }}
      >
        {text}
      </div>
      {/* Main Text */}
      <div className="relative z-10 text-brand-offwhite font-black tracking-widest font-mono">
        {text}
      </div>
    </div>
  );
}
