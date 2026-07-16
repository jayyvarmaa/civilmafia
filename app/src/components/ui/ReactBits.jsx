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
