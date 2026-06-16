import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function CreateRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [minQuotaValue, setMinQuotaValue] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email'); // email | cpf | phone | random
  const [deadline, setDeadline] = useState(''); // datetime-local
  const [regraEmpate, setRegraEmpate] = useState('acumular'); // acumular | banca
  const [regraBancaComissionada, setRegraBancaComissionada] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    homeTeam?: string;
    awayTeam?: string;
    minQuotaValue?: string;
    pixKey?: string;
    deadline?: string;
  }>({});
  const [sport, setSport] = useState('Futebol');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');

  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch creator's name on mount
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        if (data?.name) {
          setProfileName(data.name);
        } else {
          setProfileName(user.user_metadata?.name || user.email?.split('@')[0] || 'Organizador');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setProfileName(user.user_metadata?.name || user.email?.split('@')[0] || 'Organizador');
      }
    };
    fetchProfile();
  }, [user]);

  // Auto‑generate title based on creator's name and selected teams
  useEffect(() => {
    if (profileName && homeTeam.trim() && awayTeam.trim()) {
      setTitle(`Resenha "${profileName}" | ${homeTeam.trim()} x ${awayTeam.trim()}`);
    } else {
      setTitle('');
    }
  }, [profileName, homeTeam, awayTeam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const errors: typeof fieldErrors = {};
    if (!homeTeam.trim()) errors.homeTeam = 'Time de casa é obrigatório.';
    if (!awayTeam.trim()) errors.awayTeam = 'Time de fora é obrigatório.';
    if (!minQuotaValue) errors.minQuotaValue = 'Valor da aposta é obrigatório.';
    if (!deadline) errors.deadline = 'Horário limite é obrigatório.';
    
    if (!pixKey.trim()) {
      errors.pixKey = 'Chave Pix é obrigatória.';
    } else {
      if (pixKeyType === 'email') {
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailRegex.test(pixKey.trim())) {
          errors.pixKey = 'Informe um e-mail válido para a chave Pix.';
        }
      } else if (pixKeyType === 'cpf') {
        const digits = pixKey.replace(/\D/g, '');
        if (digits.length !== 11) {
          errors.pixKey = 'Informe um CPF válido (11 dígitos).';
        }
      } else if (pixKeyType === 'phone') {
        const digits = pixKey.replace(/\D/g, '');
        if (digits.length < 10) {
          errors.pixKey = 'Informe um telefone válido.';
        }
      } else if (pixKeyType === 'random') {
        const cleanKey = pixKey.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (cleanKey.length !== 32) {
          errors.pixKey = 'A chave aleatória deve ter exatamente 32 caracteres alfanuméricos.';
        }
      }
    }

    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (deadlineDate <= new Date()) {
        errors.deadline = 'O horário limite para palpites deve ser uma data/hora no futuro.';
      }
    }

    const quota = parseFloat(minQuotaValue.replace(/[^\d,]/g, '').replace(',', '.'));
    if (minQuotaValue && (isNaN(quota) || quota <= 0)) {
      errors.minQuotaValue = 'O valor da aposta deve ser válido e maior que zero.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const { error: insertError } = await supabase.from('rooms').insert({
        creator_id: user?.id,
        title: title,
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        valor_da_cota: quota,
        horario_limite: deadline ? deadline : null,
        regra_empate: regraEmpate,
        regra_banca_comissionada: regraBancaComissionada,
        pix_key: pixKeyType === 'random' ? pixKey.replace(/-/g, '').trim() : pixKey.trim(),
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
          {fieldErrors.homeTeam && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.homeTeam}</p>
          )}
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
          {fieldErrors.awayTeam && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.awayTeam}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Título da Resenha</label>
          <input
            type="text"
            value={title}
            readOnly
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
        </div>
        {/* Valor da Aposta with currency mask */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Valor da Aposta</label>
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
          {fieldErrors.minQuotaValue && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.minQuotaValue}</p>
          )}
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
            <option value="random">Chave aleatória</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Data e Horário Limite</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.deadline && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.deadline}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Regra para Empate</label>
          <select
            value={regraEmpate}
            onChange={(e) => setRegraEmpate(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="acumular">Acumular (pot)</option>
            <option value="banca">Banca (vai para a casa)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={regraBancaComissionada}
            onChange={() => setRegraBancaComissionada(!regraBancaComissionada)}
            disabled={loading}
          />
          <label className="text-xs font-bold text-on-surface/60">Regra Banca Comissionada</label>
        </div>

        {/* Sua Chave Pix para Recebimento with dynamic mask/validation */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Sua Chave Pix para Recebimento</label>
          <input
            type="text"
            placeholder={pixKeyType === 'email' ? 'exemplo@dominio.com' : pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'phone' ? '(00) 00000-0000' : '00000000-0000-0000-0000-000000000000'}
            value={pixKey}
            onChange={(e) => {
              let val = e.target.value;
              if (pixKeyType === 'cpf') {
                // limit to 11 digits and format CPF xxx.xxx.xxx-xx
                const digits = val.replace(/\D/g, '').slice(0, 11);
                val = digits.replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
              } else if (pixKeyType === 'phone') {
                // format (xx) xxxxx-xxxx
                const digits = val.replace(/\D/g, '').slice(0, 11);
                const d = digits.replace(/^([0-9]{2})([0-9]{5})([0-9]{4}).*/, '($1) $2-$3');
                val = d;
              } else if (pixKeyType === 'random') {
                const clean = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
                const parts = [];
                if (clean.length > 0) parts.push(clean.slice(0, 8));
                if (clean.length > 8) parts.push(clean.slice(8, 12));
                if (clean.length > 12) parts.push(clean.slice(12, 16));
                if (clean.length > 16) parts.push(clean.slice(16, 20));
                if (clean.length > 20) parts.push(clean.slice(20, 32));
                val = parts.join('-');
              }
              setPixKey(val);
            }}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.pixKey && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.pixKey}</p>
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
