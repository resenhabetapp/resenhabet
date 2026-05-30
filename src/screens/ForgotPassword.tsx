import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess('Link de recuperação enviado! Verifique seu e-mail.');
        setEmail('');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao enviar o e-mail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
        {/* Left side promotional text for desktop */}
        <div className="hidden lg:flex flex-col justify-center items-center bg-primary text-on-primary p-8">
          <h2 className="font-display text-2xl font-bold text-center mb-2">
            O bolão com a galera ficou fácil de verdade.
          </h2>
          <p className="text-base text-center">
            Sem taxas, sem segredos.
          </p>
        </div>

        {/* Right side form */}
        <div className="flex flex-col justify-center p-4 md:p-8 relative">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 justify-center mb-4">
            <img src="https://resenhabet.app/assets/apple-touch-icon.png" alt="Resenha Bet Logo" className="w-10 h-10 rounded-lg object-cover" />
            <h1 className="font-display text-4xl font-bold text-on-surface">Resenha Bet</h1>
          </div>
          <p className="text-sm text-on-surface/60 mt-2 mb-6 text-center">Recupere o acesso à sua conta</p>

          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6 max-w-md mx-auto w-full">
            <h2 className="font-display text-xl font-bold text-on-surface">Recuperar Senha</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-primary/10 border border-primary/30 text-primary p-3 rounded-lg text-sm font-medium">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-12 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-[0.98] transition-transform mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Instruções'
                )}
              </button>
            </form>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-on-surface/60">
              Lembrou a senha?{' '}
              <Link to="/" className="text-primary font-bold hover:underline">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
  );
}
