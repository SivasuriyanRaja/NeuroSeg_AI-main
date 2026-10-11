import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail, User, Stethoscope, GraduationCap, FlaskConical } from 'lucide-react';
import { AuthScaffold, PasswordField } from './auth-scaffold';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';

const PROFESSION_OPTIONS = [
  { value: 'doctor',     label: 'Doctor',     Icon: Stethoscope },
  { value: 'researcher', label: 'Researcher',  Icon: FlaskConical },
  { value: 'student',    label: 'Student',     Icon: GraduationCap },
];

export function RegisterPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profession, setProfession] = useState('doctor');
  const [prefix, setPrefix] = useState('Dr.');

  function selectProfession(val: string) {
    setProfession(val);
    if (val === 'doctor') {
      setPrefix('Dr.');
    } else if (prefix === 'Dr.') {
      setPrefix('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const prefixVal  = String(data.get('prefix')      || prefix || '').trim();
    const username   = String(data.get('username')    || '').trim();
    const email      = String(data.get('email')       || '').trim();
    const firstName  = String(data.get('first_name')  || '').trim();
    const lastName   = String(data.get('last_name')   || '').trim();
    const password   = String(data.get('password')    || '');
    const confirm    = String(data.get('confirmPassword') || '');

    if (!username && (!firstName || !lastName)) {
      setError('Please enter a username or your first and last name.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match. Check them and try again.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const computedUsername = username || `${firstName} ${lastName}`.trim();
      const regRes = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username: computedUsername,
          prefix: prefixVal,
          first_name: firstName || computedUsername,
          last_name: lastName || '',
          profession,
        }),
      });
      if (!regRes.ok) {
        const err = await regRes.json().catch(() => ({}));
        throw new Error((err as any).detail || 'Registration failed.');
      }
      const userData = await regRes.json();

      // Auto-login
      const body = new URLSearchParams();
      body.append('username', email);
      body.append('password', password);
      const loginRes = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (loginRes.ok) {
        const json = await loginRes.json();
        login(json.access_token, userData, '/dashboard');
      } else {
        login('', userData, '/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      kicker="JOIN NEUROSEG AI"
      title="Create your account"
      description="Set up your clinical research workspace in seconds."
      notice={error}
      switchText="Already have an account?"
      switchHref="/login"
      switchLinkText="Log in"
    >
      <form onSubmit={handleSubmit} onChange={() => error && setError('')}>

        {/* Title/Prefix + Username row */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 12 }}>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label className="auth-label" htmlFor="register-prefix">Prefix / Title</label>
            <div className="auth-input-wrap">
              <select
                id="register-prefix"
                name="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="auth-input"
                style={{
                  paddingLeft: 12,
                  paddingRight: 8,
                  cursor: 'pointer',
                  backgroundColor: '#0c1622',
                  color: '#e2e8f0',
                  colorScheme: 'dark',
                }}
              >
                <option value="Dr." style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>Dr.</option>
                <option value="Prof." style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>Prof.</option>
                <option value="Mr." style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>Mr.</option>
                <option value="Ms." style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>Ms.</option>
                <option value="Mrs." style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>Mrs.</option>
                <option value="" style={{ backgroundColor: '#0c1622', color: '#e2e8f0' }}>None</option>
              </select>
            </div>
          </div>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label className="auth-label" htmlFor="register-username">Username</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" size={15} aria-hidden="true" />
              <input
                className="auth-input"
                id="register-username"
                name="username"
                autoComplete="username"
                placeholder="Choose a username"
                required
              />
            </div>
          </div>
        </div>

        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label className="auth-label" htmlFor="register-firstname">First Name (Optional)</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" size={15} aria-hidden="true" />
              <input
                className="auth-input"
                id="register-firstname"
                name="first_name"
                autoComplete="given-name"
                placeholder="First name"
              />
            </div>
          </div>
          <div className="auth-field" style={{ marginBottom: 0 }}>
            <label className="auth-label" htmlFor="register-lastname">Last Name (Optional)</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" size={15} aria-hidden="true" />
              <input
                className="auth-input"
                id="register-lastname"
                name="last_name"
                autoComplete="family-name"
                placeholder="Last name"
              />
            </div>
          </div>
        </div>

        {/* Profession selector */}
        <div className="auth-field">
          <label className="auth-label">Select Role / Profession</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PROFESSION_OPTIONS.map(opt => {
              const active = profession === opt.value;
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectProfession(opt.value)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: active
                      ? '1.5px solid #0d9488'
                      : '1.5px solid rgba(141,164,183,0.15)',
                    background: active
                      ? 'rgba(13,148,136,0.14)'
                      : 'rgba(255,255,255,0.03)',
                    color: active ? '#5eead4' : '#8ea3ad',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                    textAlign: 'center',
                    transition: 'all .15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon size={20} style={{ color: active ? '#2dd4bf' : '#64748b' }} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Email */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="register-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" size={15} aria-hidden="true" />
            <input
              className="auth-input"
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@institution.edu"
              required
            />
          </div>
        </div>

        <PasswordField
          id="register-password"
          label="Password"
          name="password"
          autoComplete="new-password"
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((v) => !v)}
        />

        <PasswordField
          id="register-confirm-password"
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          visible={confirmVisible}
          onToggle={() => setConfirmVisible((v) => !v)}
        />

        <label className="auth-consent" style={{ margin: '8px 0 16px' }}>
          <input type="checkbox" name="demo-acknowledgement" required />
          <span>I agree to the Terms of Service and Privacy Policy for NeuroSeg AI.</span>
        </label>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AuthScaffold>
  );
}
