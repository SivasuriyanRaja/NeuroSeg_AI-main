import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';

/* --- Particle Canvas Background --- */
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
  pulse: number; pulseSpeed: number;
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const particles = useRef<Particle[]>([]);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  }, []);

  const spawn = useCallback((w: number, h: number): Particle => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
    r: Math.random() * 1.6 + 0.4,
    alpha: Math.random() * 0.55 + 0.1,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: Math.random() * 0.012 + 0.004,
  }), []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    resize();
    window.addEventListener('resize', resize);
    const COUNT = 110;
    particles.current = Array.from({ length: COUNT }, () => spawn(c.width, c.height));

    const draw = () => {
      const { width: W, height: H } = c;
      ctx.clearRect(0, 0, W, H);
      const pts = particles.current;

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(13,200,180,${(1 - dist / 120) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      pts.forEach(p => {
        p.pulse += p.pulseSpeed;
        const glow = Math.sin(p.pulse) * 0.25 + 0.75;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, `rgba(13,200,180,${p.alpha * glow * 0.9})`);
        grad.addColorStop(1, `rgba(13,200,180,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,255,240,${p.alpha * glow})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
      });
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [resize, spawn]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
    />
  );
}

/* --- Auth Scaffold --- */
export function AuthScaffold({
  kicker, title, description, notice,
  switchText, switchHref, switchLinkText, children,
}: {
  kicker: string; title: string; description: string; notice: string;
  switchText: string; switchHref: string; switchLinkText: string; children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .auth-page-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          background: #040c14;
        }

        .auth-bg-image {
          position: absolute;
          inset: 0;
          background: url('/brainbg.jpg') center center / cover no-repeat;
          z-index: 0;
          filter: brightness(0.38) saturate(1.3);
          transform: scale(1.04);
          transition: transform 18s ease-in-out;
        }
        .auth-bg-image.mounted { transform: scale(1.0); }

        .auth-bg-vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(4,12,20,0.78) 100%),
            linear-gradient(to bottom, rgba(4,12,20,0.35) 0%, transparent 40%, rgba(4,12,20,0.5) 100%);
          z-index: 1;
        }

        .auth-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 1;
          animation: orbDrift 10s ease-in-out infinite;
        }
        .auth-orb-1 {
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(13,148,136,0.45) 0%, transparent 68%);
          top: -200px; left: -180px; animation-delay: 0s;
        }
        .auth-orb-2 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(99,40,220,0.35) 0%, transparent 68%);
          bottom: -130px; right: -110px; animation-delay: -4s;
        }
        .auth-orb-3 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 68%);
          top: 55%; left: 62%; animation-delay: -7s;
        }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0,0) scale(1); }
          40%       { transform: translate(18px,-22px) scale(1.06); }
          75%       { transform: translate(-12px,14px) scale(0.96); }
        }

        .auth-card {
          position: relative;
          width: 100%;
          max-width: 480px;
          z-index: 10;
          opacity: 0;
          transform: translateY(28px) scale(0.97);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        .auth-card.mounted { opacity: 1; transform: translateY(0) scale(1); }

        .auth-card-glow {
          position: absolute;
          inset: -1px;
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(13,148,136,0.6) 0%, rgba(99,40,220,0.3) 50%, rgba(14,165,233,0.5) 100%);
          z-index: -1;
          animation: glowSpin 5s linear infinite;
          opacity: 0.55;
          filter: blur(1px);
        }
        @keyframes glowSpin {
          0%   { filter: blur(1px) hue-rotate(0deg); }
          100% { filter: blur(1px) hue-rotate(360deg); }
        }

        .auth-card-inner {
          background: rgba(6,14,22,0.86);
          backdrop-filter: blur(32px) saturate(160%);
          -webkit-backdrop-filter: blur(32px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 21px;
          padding: 38px 36px;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 40px 80px rgba(0,0,0,0.6), 0 0 100px rgba(13,148,136,0.06), inset 0 1px 0 rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }
        .auth-card-inner::before {
          content: '';
          position: absolute;
          top: -120%; left: 0;
          width: 100%; height: 60%;
          background: linear-gradient(to bottom, transparent 0%, rgba(13,200,180,0.04) 50%, transparent 100%);
          animation: scanLine 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes scanLine {
          0%   { top: -120%; }
          100% { top: 200%; }
        }
        .auth-card-inner::after {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 100px; height: 100px;
          background: radial-gradient(circle at top right, rgba(13,148,136,0.12), transparent 70%);
          border-radius: 0 21px 0 0;
          pointer-events: none;
        }

        .auth-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          justify-content: center;
          margin-bottom: 26px;
        }
        .auth-brand-icon {
          width: 50px;
          height: 50px;
          background: rgba(13,148,136,0.12);
          border: 1px solid rgba(13,148,136,0.35);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 24px rgba(13,148,136,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
          animation: iconPulse 3s ease-in-out infinite;
          padding: 6px;
        }
        .auth-brand-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 8px;
        }
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(13,148,136,0.25); border-color: rgba(13,148,136,0.35); }
          50%       { box-shadow: 0 0 32px rgba(13,148,136,0.5); border-color: rgba(13,148,136,0.6); }
        }
        .auth-brand-text { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; color: #f0f8fb; }
        .auth-brand-sub { font-size: 10px; color: #4d7080; letter-spacing: 1.8px; text-transform: uppercase; font-weight: 600; display: block; margin-top: -1px; }

        .auth-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(13,148,136,0.25), rgba(255,255,255,0.06), transparent);
          margin: 0 -36px 26px;
        }

        .auth-kicker {
          text-align: center;
          font-size: 9.5px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 700;
          background: linear-gradient(90deg, #0d9488, #22d3ee);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }
        .auth-title { text-align: center; font-size: 25px; font-weight: 800; color: #eef6fb; margin: 0 0 6px; letter-spacing: -0.6px; line-height: 1.2; }
        .auth-desc  { text-align: center; font-size: 13px; color: #6a8290; margin: 0 0 24px; line-height: 1.5; }

        .auth-notice {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 20px;
          line-height: 1.5;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .auth-field { margin-bottom: 16px; }
        .auth-label { display: block; font-size: 11px; font-weight: 700; color: #7ea0ae; margin-bottom: 7px; letter-spacing: 0.7px; text-transform: uppercase; }
        .auth-input-wrap { position: relative; display: flex; align-items: center; }
        .auth-input-icon { position: absolute; left: 14px; color: #476575; pointer-events: none; flex-shrink: 0; transition: color 0.2s; }
        .auth-input-wrap:focus-within .auth-input-icon { color: #0d9488; }
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 11px;
          padding: 11px 14px 11px 44px;
          color: #e8f4f8;
          font-size: 13.5px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
          letter-spacing: 0.2px;
          color-scheme: dark;
        }
        select.auth-input option {
          background-color: #0b1522;
          color: #e2e8f0;
          padding: 8px 12px;
        }
        .auth-input::placeholder { color: #3d5867; font-size: 13px; }
        .auth-input:focus {
          border-color: rgba(13,148,136,0.6);
          background: rgba(13,148,136,0.04);
          box-shadow: 0 0 0 3px rgba(13,148,136,0.15), 0 2px 12px rgba(0,0,0,0.25);
        }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #071018 inset;
          -webkit-text-fill-color: #e8f4f8;
        }

        .auth-pw-toggle { position: absolute; right: 12px; background: none; border: none; color: #476575; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.15s; }
        .auth-pw-toggle:hover { color: #0d9488; }

        .auth-submit {
          width: 100%;
          background: linear-gradient(135deg, #0d9488 0%, #0c7a70 60%, #0369a1 100%);
          border: none;
          border-radius: 11px;
          padding: 13px 20px;
          color: #fff;
          font-size: 14.5px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
          transition: all 0.22s ease;
          box-shadow: 0 4px 22px rgba(13,148,136,0.35), 0 1px 0 rgba(255,255,255,0.08) inset;
          letter-spacing: 0.3px;
          position: relative;
          overflow: hidden;
        }
        .auth-submit::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 60%); border-radius: 11px; }
        .auth-submit:hover {
          background: linear-gradient(135deg, #0fb89e 0%, #0e8c80 60%, #0474b8 100%);
          box-shadow: 0 8px 32px rgba(13,148,136,0.5), 0 1px 0 rgba(255,255,255,0.1) inset;
          transform: translateY(-2px);
        }
        .auth-submit:active { transform: translateY(0); box-shadow: 0 4px 16px rgba(13,148,136,0.3); }

        .auth-consent { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: #7a8f9a; cursor: pointer; margin-bottom: 4px; line-height: 1.5; }
        .auth-consent input[type="checkbox"] {
          appearance: none; -webkit-appearance: none;
          width: 17px; height: 17px;
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 5px;
          background: rgba(255,255,255,0.03);
          cursor: pointer; flex-shrink: 0; margin-top: 1px;
          transition: all 0.2s;
        }
        .auth-consent input[type="checkbox"]:checked {
          background: #0d9488; border-color: #0d9488;
          box-shadow: 0 0 8px rgba(13,148,136,0.5);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='white' d='M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z'/%3E%3C/svg%3E");
          background-size: 10px; background-repeat: no-repeat; background-position: center;
        }

        .auth-switch { text-align: center; margin-top: 24px; font-size: 13px; color: #4e6672; }
        .auth-switch a { color: #2dd4bf; text-decoration: none; font-weight: 700; transition: color 0.15s, text-shadow 0.15s; }
        .auth-switch a:hover { color: #5eead4; text-shadow: 0 0 12px rgba(13,200,180,0.5); }

        .auth-features {
          display: flex; justify-content: center; gap: 18px; flex-wrap: wrap;
          margin-top: 24px; padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .auth-feature { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #43606e; letter-spacing: 0.3px; }
        .auth-feature-dot { width: 5px; height: 5px; border-radius: 50%; background: #0d9488; opacity: 0.8; box-shadow: 0 0 5px rgba(13,148,136,0.8); }
      `}</style>

      <div className="auth-page-bg">
        <div className={`auth-bg-image${mounted ? ' mounted' : ''}`} />
        <div className="auth-bg-vignette" />
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <ParticleCanvas />

        <div className={`auth-card${mounted ? ' mounted' : ''}`}>
          <div className="auth-card-glow" />
          <div className="auth-card-inner">
            <div className="auth-brand">
              <div className="auth-brand-icon">
                <img src="/neulogo.png" alt="NeuroSeg Logo" />
              </div>
              <div>
                <div className="auth-brand-text">NeuroSeg AI</div>
                <span className="auth-brand-sub">Clinical Research Platform</span>
              </div>
            </div>

            <div className="auth-divider" />

            <div className="auth-kicker">{kicker}</div>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-desc">{description}</p>

            {notice && (
              <div className="auth-notice">
                <AlertTriangle size={15} style={{ flexShrink: 0, color: '#f87171' }} />
                <span>{notice}</span>
              </div>
            )}

            {children}

            <div className="auth-switch">
              {switchText}{' '}
              <Link href={switchHref}>{switchLinkText}</Link>
            </div>

            <div className="auth-features">
              <div className="auth-feature"><div className="auth-feature-dot" />End-to-end encrypted</div>
              <div className="auth-feature"><div className="auth-feature-dot" />HIPAA-aware storage</div>
              <div className="auth-feature"><div className="auth-feature-dot" />Edge inference</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* --- Password Field --- */
export function PasswordField({
  id, label, name, autoComplete, visible, onToggle,
}: {
  id: string; label: string; name: string; autoComplete: string; visible: boolean; onToggle: () => void;
}) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <Lock className="auth-input-icon" size={15} aria-hidden="true" />
        <input
          className="auth-input"
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="Enter password"
          required
        />
        <button
          type="button"
          className="auth-pw-toggle"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}
