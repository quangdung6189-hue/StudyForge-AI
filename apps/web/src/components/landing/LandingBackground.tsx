// StudyForge landing background — grid + beams (animate-ui.com hero feel), CSS only + reduced-motion safe.
'use client';

export function LandingBackground() {
  return (
    <div className="sf-bg" aria-hidden="true">
      <div className="sf-bg-grid" />
      <div className="sf-bg-glow" />
      <div className="sf-bg-glow2" />
      <div className="sf-beam sf-beam-x" style={{ top: '16%' }} />
      <div className="sf-beam sf-beam-x" style={{ top: '42%', animationDelay: '-3.4s' }} />
      <div className="sf-beam sf-beam-y" style={{ left: '30%' }} />
      <div className="sf-beam sf-beam-y" style={{ left: '68%', animationDelay: '-4.2s' }} />
    </div>
  );
}
