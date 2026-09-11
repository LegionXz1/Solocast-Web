import React from 'react';

export default function ChickenMascot() {
  return (
    <div className="chicken-stage" aria-hidden="true">
      {/* Mascot Character Stage */}
      <div className="electric-chicken-viewport">
        {/* Electric Aura Halo Glow */}
        <div className="electric-aura-glow" />

        {/* Ambient Lightning Sparks */}
        <svg className="electric-spark spark-top" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FDE047" stroke="#EAB308" strokeWidth="1.5" />
        </svg>

        <svg className="electric-spark spark-left" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.5" />
        </svg>

        <svg className="electric-spark spark-right" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FDE047" stroke="#EAB308" strokeWidth="1.5" />
        </svg>

        <svg className="electric-spark spark-wing" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FEF08A" stroke="#EAB308" strokeWidth="1.5" />
        </svg>

        {/* Animated Chicken Image Wrapper */}
        <div className="chicken-character-wrapper">
          <img
            src="/electric-chicken.webp"
            alt="FastChick Electric Chicken Mascot"
            className="electric-chicken-img"
            width="215"
            height="215"
            fetchpriority="high"
            decoding="async"
            draggable={false}
          />
        </div>

        {/* Dynamic Ground Shadow */}
        <div className="chicken-ground-shadow" />
      </div>
    </div>
  );
}
