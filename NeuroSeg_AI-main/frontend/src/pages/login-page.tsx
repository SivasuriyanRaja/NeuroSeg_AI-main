import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { AuthScaffold, PasswordField } from './auth-scaffold';
import { Redirect } from 'wouter';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { user, token, loading: authLoading, login } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && token && user) {
    return <Redirect to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const body = new URLSearchParams();
      body.append('username', email);
      body.append('password', password);

      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail || 'Invalid email or password.');
      }

      const json = await res.json();
      
      // Fetch user profile immediately
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${json.access_token}` },
        });
        if (meRes.ok) {
          const userData = await meRes.json();
          login(json.access_token, userData, '/dashboard');
          return;
        }
      } catch (e) {
        console.error(e);
      }

      login(json.access_token, null, '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      kicker="RESEARCHER ACCESS"
      title="Welcome back"
      description="Sign in to continue to your research workspace."
      notice={error}
      switchText="New to NeuroSeg?"
      switchHref="/register"
      switchLinkText="Create an account"
    >
      <form onSubmit={handleSubmit} onChange={() => error && setError('')}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" size={15} aria-hidden="true" />
            <input
              className="auth-input"
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@institution.edu"
              required
            />
          </div>
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          name="password"
          autoComplete="current-password"
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((v) => !v)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: '#4d6470', cursor: 'pointer' }}>Forgot password?</span>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Signing in...
            </>
          ) : (
            <>
              Continue to workspace
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AuthScaffold>
  );
}
