import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

interface Room {
  id: string;
  title: string;
  home_team: string;
  away_team: string;
  valor_da_cota: number;
  horario_limite: string | null; // ISO datetime
  pix_key: string;
  pix_key_type: string;
  status: string;
}

export default function BettorPage() {
  const { id } = useParams<{ id: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [bettorName, setBettorName] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [bettorPixKey, setBettorPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email'); // email | cpf | phone
  const [emailError, setEmailError] = useState<string | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Result state
  const [successGuess, setSuccessGuess] = useState<any | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchRoom = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !data) {
          setError('Resenha não encontrada ou link inválido.');
        } else if (data.status !== 'active' || (data.horario_limite && new Date() > new Date(data.horario_limite))) {
          setRoom(data);
          setError('Esta resenha está fechada para novos palpites (status ou prazo).');
        } else {
          setRoom(data);
        }
      } catch (err) {
        setError('Ocorreu um erro ao carregar os dados.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);

    if (!bettorName.trim() || !homeScore.trim() || !awayScore.trim() || !bettorPixKey.trim()) {
      setError('Por favor, preencha todos os campos.');
      setSubmitLoading(false);
      return;
    }

    const homeVal = parseInt(homeScore);
    const awayVal = parseInt(awayScore);

    if (isNaN(homeVal) || homeVal < 0 || isNaN(awayVal) || awayVal < 0) {
      setError('Placar inválido.');
      setSubmitLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_guess', {
        p_room_id: id,
        p_bettor_name: bettorName.trim(),
        p_bettor_pix_key: bettorPixKey.trim(),
        p_home_score: homeVal,
        p_away_score: awayVal,
      });

      if (rpcError) {
        setError(rpcError.message);
      } else {
        const guessData = Array.isArray(data) ? data[0] : data;
        if (guessData?.id) {
          localStorage.setItem('pending_guess_id', guessData.id);
          // Se já estiver logado, vincula imediatamente
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase
              .from('guesses')
              .update({ user_id: session.user.id })
              .eq('id', guessData.id);
            localStorage.removeItem('pending_guess_id');
          }
        }
        setSuccessGuess(guessData);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao submeter palpite.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_var(--loader-shadow)]" />
        <p className="font-display text-sm font-bold text-on-surface/60 uppercase tracking-widest animate-pulse">
          Carregando Arena...
        </p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-surface px-4 py-8 flex flex-col justify-center items-center gap-6">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center max-w-sm">
          <p className="font-bold font-display mb-1">Erro</p>
          <p className="text-sm">{error}</p>
        </div>
        <Link to="/" className="text-primary font-bold hover:underline">
          Ir para Página Inicial
        </Link>
      </div>
    );
  }

  // Payment instruction screen
  if (successGuess && room) {
    return (
      <div className="min-h-screen bg-surface px-4 py-6 flex flex-col gap-6 justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center mb-[-8px]">
            <span className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">Resenha Bet</span>
            <ThemeToggle />
          </div>
          
          <div className="text-center py-4 bg-surface-container-low rounded-xl">
            <span className="text-xs text-primary font-bold tracking-widest uppercase">Palpite Registrado!</span>
            <h1 className="font-display text-3xl font-bold text-on-surface mt-2">
              {room.home_team} × {room.away_team}
            </h1>
            <p className="text-sm text-on-surface/60 mt-1">Seu Placar: {successGuess.home_score} x {successGuess.away_score}</p>
          </div>

          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant text-center flex flex-col gap-3">
            <p className="text-xs text-on-surface/60 uppercase tracking-wider">Valor Exato do Pix</p>
            <p className="font-display text-5xl font-bold text-primary">
              R$ {Number(successGuess.final_value).toFixed(2).replace('.', ',')}
            </p>
            <div className="bg-surface-container-highest p-3 rounded-lg border border-outline-variant-raw/10 text-[11px] text-on-surface/80 leading-relaxed text-left">
              <span className="text-primary font-bold">Atenção:</span> Transfira **exatamente** o valor acima. 
              Os centavos dinâmicos (<span className="text-primary">.{String(successGuess.dynamic_cents).padStart(2, '0')}</span>) 
              servem para o criador identificar seu pagamento.
            </div>
          </div>

          {/* Pix copy component */}
          <div className="bg-surface-container p-5 rounded-xl flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Chave Pix do Organizador</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={room.pix_key}
                className="flex-1 h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room.pix_key);
                  alert('Chave Pix copiada!');
                }}
                className="px-4 h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-95 transition-transform"
              >
                Copiar
              </button>
            </div>
          </div>

          {/* Card promocional para incentivar cadastro/download do app */}
          {!isLoggedIn && (
            <div className="bg-primary/10 border border-primary/20 p-5 rounded-xl text-center flex flex-col gap-3">
              <h3 className="font-display font-bold text-primary text-sm">Acompanhe todos os seus palpites!</h3>
              <p className="text-xs text-on-surface/85 leading-relaxed">
                Faça o cadastro no nosso app para ver em tempo real os palpites dos seus amigos, acompanhar o placar e gerenciar todas as suas resenhas!
              </p>
              <div className="flex gap-2">
                <Link
                  to="/register"
                  className="flex-1 h-10 bg-primary text-on-primary font-display font-bold text-xs rounded-lg flex items-center justify-center shadow-neon active:scale-95 transition-transform"
                >
                  Cadastrar e Acompanhar
                </Link>
                <Link
                  to="/"
                  className="flex-1 h-10 bg-surface-container-highest hover:bg-outline-variant-raw/20 text-on-surface font-display font-bold text-xs rounded-lg flex items-center justify-center border border-outline-variant/30 active:scale-95 transition-transform"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 text-center">
          <p className="text-xs text-on-surface/40 leading-relaxed">
            Seu palpite está como <span className="text-amber-400 font-bold">pendente</span>.
            Após realizar o Pix, o organizador irá validar a sua cota no painel.
          </p>
          <button
            onClick={() => {
              setSuccessGuess(null);
              setHomeScore('');
              setAwayScore('');
            }}
            className="w-full h-12 bg-surface-container-highest hover:bg-outline-variant-raw/20 text-on-surface font-display font-bold rounded-lg transition-colors"
          >
            Fazer Outro Palpite
          </button>
        </div>
      </div>
    );
  }

  // Normal guess form screen
  return (
    <div className="min-h-screen bg-surface px-4 py-6 flex flex-col justify-between gap-6">
      {room && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center mb-[-8px]">
            <span className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest">Resenha Bet</span>
            <ThemeToggle />
          </div>

          <div className="text-center py-4 bg-surface-container-low rounded-xl">
            <span className="text-xs text-primary font-bold tracking-widest uppercase">Você foi convidado para palpitar</span>
            <h1 className="font-display text-3xl font-bold text-on-surface mt-2">
              {room.home_team} × {room.away_team}
            </h1>
            <p className="text-xs text-on-surface/40 mt-1 uppercase tracking-wider">Criador: {room.title}</p>
          </div>

          <div className="bg-surface-container p-6 rounded-xl border border-outline-variant text-center">
            <p className="text-xs text-on-surface/60 uppercase tracking-wider">Valor da Aposta</p>
            <p className="font-display text-4xl font-bold text-primary mt-1">
              R$ {Number(room.valor_da_cota).toFixed(2).replace('.', ',')}
            </p>
            <p className="text-[10px] text-on-surface/40 mt-2">*Serão adicionados centavos dinâmicos de identificação</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Seu Nome Completo</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={bettorName}
                onChange={(e) => setBettorName(e.target.value)}
                disabled={submitLoading}
                className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider text-center">{room.home_team}</label>
                <input
                  type="number"
                  placeholder="Placar"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  disabled={submitLoading}
                  className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-center font-display text-lg text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider text-center">{room.away_team}</label>
                <input
                  type="number"
                  placeholder="Placar"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  disabled={submitLoading}
                  className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-center font-display text-lg text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Tipo de Chave Pix</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => {
                    setPixKeyType(e.target.value);
                    setBettorPixKey('');
                    setEmailError(null);
                  }}
                  disabled={submitLoading}
                  className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="email">E‑mail</option>
                  <option value="cpf">CPF</option>
                  <option value="phone">Telefone</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Sua Chave Pix (para receber prêmio)</label>
                <input
                  type="text"
                  placeholder={pixKeyType === 'email' ? 'exemplo@dominio.com' : pixKeyType === 'cpf' ? '000.000.000-00' : '(00) 00000-0000'}
                  value={bettorPixKey}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (pixKeyType === 'email') {
                      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
                      if (!emailRegex.test(val.trim())) {
                        setEmailError('Por favor, informe um e‑mail válido.');
                      } else {
                        setEmailError(null);
                      }
                    } else if (pixKeyType === 'cpf') {
                      // limit to 11 digits and format CPF xxx.xxx.xxx-xx
                      const digits = val.replace(/\D/g, '').slice(0, 11);
                      val = digits.replace(/(\d{3})(\d)/, '$1.$2')
                                 .replace(/(\d{3})(\d)/, '$1.$2')
                                 .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
                    } else if (pixKeyType === 'phone') {
                      // format (xx) xxxxx-xxxx
                      const digits = val.replace(/\D/g, '').slice(0, 11);
                      val = digits.replace(/^([0-9]{2})([0-9]{5})([0-9]{4}).*/, '($1) $2-$3');
                    }
                    setBettorPixKey(val);
                  }}
                  disabled={submitLoading}
                  className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary disabled:opacity-50"
                />
                {pixKeyType === 'email' && emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

            <button
              type="submit"
              disabled={submitLoading || room.status !== 'active'}
              className="w-full h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {submitLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Registrando Palpite...
                </>
              ) : room.status !== 'active' ? (
                'Sala Fechada'
              ) : (
                'Confirmar Palpite e Ver Pix do Criador'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
