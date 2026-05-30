import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function CreateRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [minQuotaValue, setMinQuotaValue] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email'); // email | cpf | phone
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sport, setSport] = useState('Futebol');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!title.trim() || !minQuotaValue || !pixKey.trim() || !homeTeam.trim() || !awayTeam.trim()) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    // Extract numeric value from currency string (e.g., "R$ 12,34")
    const quota = parseFloat(minQuotaValue.replace(/[^\d,]/g, '').replace(',', '.'));

    // Validate Pix key based on selected type
    if (pixKeyType === 'email') {
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(pixKey.trim())) {
        setEmailError('Por favor, informe um e‑mail válido para a chave Pix.');
        setLoading(false);
        return;
      } else {
        setEmailError(null);
      }
    } else if (pixKeyType === 'cpf') {
      const digits = pixKey.replace(/\D/g, '');
      if (digits.length !== 11) {
        setError('Por favor, informe um CPF válido (11 dígitos).');
        setLoading(false);
        return;
      }
    } else if (pixKeyType === 'phone') {
      const digits = pixKey.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Por favor, informe um telefone válido.');
        setLoading(false);
        return;
      }
    }
    if (isNaN(quota) || quota < 0) {
      setError('O valor da cota deve ser válido.');
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase.from('rooms').insert({
          creator_id: user?.id,
          title: title.trim(),
          home_team: homeTeam.trim(),
          away_team: awayTeam.trim(),
          min_quota_value: quota,
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          sport: sport,
          status: 'active',
        });

      if (insertError) {
        if (insertError.message.includes('Saldo de tokens insuficiente')) {
          setError('Saldo de tokens insuficiente para criar uma nova resenha.');
        } else {
          setError(insertError.message);
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao tentar criar a resenha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-primary font-bold hover:underline">
          ← Voltar
        </Link>
        <h2 className="font-display text-2xl font-bold text-on-surface">Nova Resenha</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Título da Resenha</label>
          <input
            type="text"
            placeholder="Ex: Bolão do Bar do Zé"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
        </div>
        {/* Sport selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Esporte</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="Futebol">Futebol</option>
            <option value="Tênis">Tênis</option>
          </select>
        </div>

        {/* Confronto (Times de Casa e Fora) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Time de Casa</label>
            <input
              type="text"
              placeholder="Ex: Brasil"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Time de Fora</label>
            <input
              type="text"
              placeholder="Ex: Argentina"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Valor da Cota Mínima with currency mask */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Valor da Cota Mínima</label>
          <input
            type="text"
            placeholder="R$ 0,00"
            value={minQuotaValue}
            onChange={(e) => {
              // Remove non‑digits, format as currency BRL
              const digits = e.target.value.replace(/\D/g, '');
              const number = digits ? (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
              setMinQuotaValue(number ? `R$ ${number}` : '');
            }}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
        </div>

        {/* Tipo de chave Pix */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Tipo de Chave Pix</label>
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="email">E‑mail</option>
            <option value="cpf">CPF</option>
            <option value="phone">Telefone</option>
          </select>
        </div>

        {/* Sua Chave Pix para Recebimento with dynamic mask/validation */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Sua Chave Pix para Recebimento</label>
          <input
            type="text"
            placeholder={pixKeyType === 'email' ? 'exemplo@dominio.com' : pixKeyType === 'cpf' ? '000.000.000-00' : '(00) 00000-0000'}
            value={pixKey}
            onChange={(e) => {
              let val = e.target.value;
              if (pixKeyType === 'cpf') {
                // limit to 11 digits and format CPF xxx.xxx.xxx-xx
                const digits = val.replace(/\D/g, '').slice(0, 11);
                val = digits.replace(/(\d{3})(\d)/, '$1.$2')
                           .replace(/(\d{3})(\d)/, '$1.$2')
                           .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
              } else if (pixKeyType === 'phone') {
                // format (xx) xxxxx-xxxx
                const digits = val.replace(/\D/g, '').slice(0, 11);
                const d = digits.replace(/^([0-9]{2})([0-9]{5})([0-9]{4}).*/, '($1) $2-$3');
                val = d;
              }
              setPixKey(val);
            }}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {pixKeyType === 'email' && emailError && (
            <p className="text-xs text-red-500 mt-1">{emailError}</p>
          )}
        </div>

        <div className="mt-auto pt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Criando Resenha...
              </>
            ) : (
              'Criar Sala e Gerar Link'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
