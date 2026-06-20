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
  sport?: string;
  bet_type?: string;
  event_data?: any;
}

export default function BettorPage() {
  const { id } = useParams<{ id: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [bettorName, setBettorName] = useState('');
  const [bettorPixKey, setBettorPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email'); // email | cpf | phone
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Sport-specific form states
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [selectedWinner, setSelectedWinner] = useState(''); // home | draw | away | player_a | player_b
  const [selectedSetsScore, setSelectedSetsScore] = useState(''); // e.g. 2x1, 3x0
  const [selectedOverUnder, setSelectedOverUnder] = useState(''); // over | under
  const [selectedF1Winner, setSelectedF1Winner] = useState('');
  const [podium1, setPodium1] = useState('');
  const [podium2, setPodium2] = useState('');
  const [podium3, setPodium3] = useState('');

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

    if (!bettorName.trim() || !bettorPixKey.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      setSubmitLoading(false);
      return;
    }

    if (bettorName.trim().length > 60) {
      setError('O nome deve ter no máximo 60 caracteres.');
      setSubmitLoading(false);
      return;
    }

    let guessData: any = {};
    let homeVal: number | null = null;
    let awayVal: number | null = null;

    // Validate based on sport and bet type
    const sport = room?.sport || 'Futebol';
    const betType = room?.bet_type || 'placar_exato';

    if (sport === 'Futebol') {
      if (betType === 'placar_exato') {
        homeVal = parseInt(homeScore);
        awayVal = parseInt(awayScore);
        if (isNaN(homeVal) || homeVal < 0 || isNaN(awayVal) || awayVal < 0) {
          setError('Por favor, informe um placar válido.');
          setSubmitLoading(false);
          return;
        }
        guessData = { home_score: homeVal, away_score: awayVal };
      } else if (betType === 'resultado_final') {
        if (!selectedWinner) {
          setError('Selecione o vencedor do jogo.');
          setSubmitLoading(false);
          return;
        }
        guessData = { winner: selectedWinner };
      }
    } else if (sport === 'Tênis') {
      if (betType === 'vencedor') {
        if (!selectedWinner) {
          setError('Selecione o jogador vencedor.');
          setSubmitLoading(false);
          return;
        }
        guessData = { winner: selectedWinner };
      } else if (betType === 'placar_sets') {
        if (!selectedSetsScore) {
          setError('Selecione o placar de sets do jogo.');
          setSubmitLoading(false);
          return;
        }
        const isPlayerAWinner = selectedSetsScore.startsWith('2') || selectedSetsScore.startsWith('3');
        guessData = {
          winner: isPlayerAWinner ? 'player_a' : 'player_b',
          sets_score: selectedSetsScore
        };
      }
    } else if (sport === 'Basquete') {
      if (betType === 'vencedor') {
        if (!selectedWinner) {
          setError('Selecione o vencedor do confronto.');
          setSubmitLoading(false);
          return;
        }
        guessData = { winner: selectedWinner };
      } else if (betType === 'pontos_total') {
        if (!selectedOverUnder) {
          setError('Selecione Mais de ou Menos de pontos (Over/Under).');
          setSubmitLoading(false);
          return;
        }
        guessData = { over_under: selectedOverUnder };
      }
    } else if (sport === 'Vôlei') {
      if (betType === 'vencedor') {
        if (!selectedWinner) {
          setError('Selecione o time vencedor.');
          setSubmitLoading(false);
          return;
        }
        guessData = { winner: selectedWinner };
      } else if (betType === 'placar_sets') {
        if (!selectedSetsScore) {
          setError('Selecione o placar de sets.');
          setSubmitLoading(false);
          return;
        }
        const isHomeWinner = selectedSetsScore.startsWith('3');
        guessData = {
          winner: isHomeWinner ? 'home' : 'away',
          sets_score: selectedSetsScore
        };
      }
    } else if (sport === 'Fórmula 1') {
      if (betType === 'vencedor_corrida') {
        if (!selectedF1Winner) {
          setError('Selecione o piloto vencedor.');
          setSubmitLoading(false);
          return;
        }
        guessData = { winner: selectedF1Winner };
      } else if (betType === 'podio') {
        if (!podium1 || !podium2 || !podium3) {
          setError('Selecione os 3 pilotos do pódio.');
          setSubmitLoading(false);
          return;
        }
        if (podium1 === podium2 || podium1 === podium3 || podium2 === podium3) {
          setError('Os pilotos do pódio não podem se repetir.');
          setSubmitLoading(false);
          return;
        }
        guessData = { podium: [podium1, podium2, podium3] };
      }
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_guess', {
        p_room_id: id,
        p_bettor_name: bettorName.trim(),
        p_bettor_pix_key: bettorPixKey.trim(),
        p_home_score: homeVal,
        p_away_score: awayVal,
        p_guess_data: guessData,
      });

      if (rpcError) {
        setError(rpcError.message);
      } else {
        const guessDataRes = Array.isArray(data) ? data[0] : data;
        if (guessDataRes?.id) {
          localStorage.setItem('pending_guess_id', guessDataRes.id);
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase
              .from('guesses')
              .update({ user_id: session.user.id })
              .eq('id', guessDataRes.id);
            localStorage.removeItem('pending_guess_id');
          }
        }
        setSuccessGuess(guessDataRes);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao submeter palpite.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const renderGuessSummary = () => {
    if (!successGuess || !room) return null;
    const sport = room.sport || 'Futebol';
    const betType = room.bet_type || 'placar_exato';
    const g = successGuess.guess_data || {};

    if (sport === 'Futebol') {
      if (betType === 'placar_exato') {
        return `Seu Placar: ${successGuess.home_score} x ${successGuess.away_score}`;
      } else {
        return `Seu Palpite: Vencedor - ${g.winner === 'home' ? room.home_team : g.winner === 'draw' ? 'Empate' : room.away_team}`;
      }
    } else if (sport === 'Tênis') {
      const playerA = room.event_data?.player_a || room.home_team;
      const playerB = room.event_data?.player_b || room.away_team;
      if (betType === 'vencedor') {
        return `Seu Palpite: Vencedor - ${g.winner === 'player_a' ? playerA : playerB}`;
      } else {
        return `Seu Palpite: Placar de Sets - ${g.sets_score}`;
      }
    } else if (sport === 'Basquete') {
      if (betType === 'vencedor') {
        return `Seu Palpite: Vencedor - ${g.winner === 'home' ? room.home_team : room.away_team}`;
      } else {
        const line = room.event_data?.line || '210.5';
        return `Seu Palpite: Total de Pontos - ${g.over_under === 'over' ? 'Mais de' : 'Menos de'} ${line}`;
      }
    } else if (sport === 'Vôlei') {
      if (betType === 'vencedor') {
        return `Seu Palpite: Vencedor - ${g.winner === 'home' ? room.home_team : room.away_team}`;
      } else {
        return `Seu Palpite: Placar de Sets - ${g.sets_score}`;
      }
    } else if (sport === 'Fórmula 1') {
      if (betType === 'vencedor_corrida') {
        return `Seu Palpite: Vencedor - ${g.winner}`;
      } else {
        const pod = g.podium || [];
        return `Seu Pódio: 1º: ${pod[0] || '-'} | 2º: ${pod[1] || '-'} | 3º: ${pod[2] || '-'}`;
      }
    }
    return '';
  };

  const getSportIcon = (s: string) => {
    switch (s) {
      case 'Tênis': return '🎾';
      case 'Basquete': return '🏀';
      case 'Vôlei': return '🏐';
      case 'Fórmula 1': return '🏎️';
      default: return '⚽';
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
            <h1 className="font-display text-2xl font-bold text-on-surface mt-2 px-2">
              {room.sport === 'Fórmula 1' ? `${room.event_data?.gp_name || room.home_team}` : `${room.home_team} × ${room.away_team}`}
            </h1>
            <p className="text-sm text-on-surface/60 mt-1 font-semibold text-primary">{renderGuessSummary()}</p>
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
              setSelectedWinner('');
              setSelectedSetsScore('');
              setSelectedOverUnder('');
              setSelectedF1Winner('');
              setPodium1('');
              setPodium2('');
              setPodium3('');
            }}
            className="w-full h-12 bg-surface-container-highest hover:bg-outline-variant-raw/20 text-on-surface font-display font-bold rounded-lg transition-colors"
          >
            Fazer Outro Palpite
          </button>
        </div>
      </div>
    );
  }

  const sport = room?.sport || 'Futebol';
  const betType = room?.bet_type || 'placar_exato';

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
            <span className="text-xs text-primary font-bold tracking-widest uppercase flex items-center justify-center gap-1">
              <span>{getSportIcon(sport)}</span>
              <span>Você foi convidado para palpitar ({sport})</span>
            </span>
            <h1 className="font-display text-2xl font-bold text-on-surface mt-2 px-2">
              {sport === 'Fórmula 1' ? `${room.event_data?.gp_name || room.home_team}` : `${room.home_team} × ${room.away_team}`}
            </h1>
            <p className="text-xs text-on-surface/40 mt-1 uppercase tracking-wider">Criador: {room.title}</p>
            {room.horario_limite && (
              <p className="text-xs text-red-500 font-bold mt-1 uppercase tracking-wider">
                Limite para palpites: {new Date(room.horario_limite).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
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
                maxLength={60}
                className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>

            {/* Dynamic Betting Inputs Section */}
            
            {/* 1. Futebol / Placar Exato */}
            {sport === 'Futebol' && betType === 'placar_exato' && (
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
            )}

            {/* 2. Futebol / Resultado Final */}
            {sport === 'Futebol' && betType === 'resultado_final' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Palpite Vencedor</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('home')}
                    className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                      selectedWinner === 'home'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    {room.home_team}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('draw')}
                    className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                      selectedWinner === 'draw'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    Empate
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('away')}
                    className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                      selectedWinner === 'away'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    {room.away_team}
                  </button>
                </div>
              </div>
            )}

            {/* 3. Tênis / Vencedor */}
            {sport === 'Tênis' && betType === 'vencedor' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Vencedor</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('player_a')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'player_a'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Jogador 1</span>
                    <span className="truncate max-w-full font-semibold">{room.event_data?.player_a || room.home_team}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('player_b')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'player_b'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Jogador 2</span>
                    <span className="truncate max-w-full font-semibold">{room.event_data?.player_b || room.away_team}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Tênis / Placar de Sets */}
            {sport === 'Tênis' && betType === 'placar_sets' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Placar Exato de Sets</label>
                <div className="grid grid-cols-2 gap-2">
                  {room.event_data?.best_of === 5 ? (
                    <>
                      {['3x0', '3x1', '3x2', '2x3', '1x3', '0x3'].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setSelectedSetsScore(score)}
                          className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                            selectedSetsScore === score
                              ? 'bg-primary/20 border-primary text-primary shadow-neon'
                              : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                          }`}
                        >
                          {score} ({score.startsWith('3') ? (room.event_data?.player_a || room.home_team).split(' ')[0] : (room.event_data?.player_b || room.away_team).split(' ')[0]})
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {['2x0', '2x1', '1x2', '0x2'].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setSelectedSetsScore(score)}
                          className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                            selectedSetsScore === score
                              ? 'bg-primary/20 border-primary text-primary shadow-neon'
                              : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                          }`}
                        >
                          {score} ({score.startsWith('2') ? (room.event_data?.player_a || room.home_team).split(' ')[0] : (room.event_data?.player_b || room.away_team).split(' ')[0]})
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 5. Basquete / Vencedor */}
            {sport === 'Basquete' && betType === 'vencedor' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Vencedor</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('home')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'home'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Mandante</span>
                    <span className="truncate max-w-full font-semibold">{room.home_team}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('away')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'away'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Visitante</span>
                    <span className="truncate max-w-full font-semibold">{room.away_team}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. Basquete / Pontos Total */}
            {sport === 'Basquete' && betType === 'pontos_total' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Pontos Totais (Linha: {room.event_data?.line || '210.5'})</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOverUnder('over')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedOverUnder === 'over'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="truncate max-w-full font-bold text-primary">Over (Mais de)</span>
                    <span className="text-[10px] text-on-surface/60 font-semibold">+{room.event_data?.line || '210.5'} pontos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOverUnder('under')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedOverUnder === 'under'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="truncate max-w-full font-bold text-primary">Under (Menos de)</span>
                    <span className="text-[10px] text-on-surface/60 font-semibold">-{room.event_data?.line || '210.5'} pontos</span>
                  </button>
                </div>
              </div>
            )}

            {/* 7. Vôlei / Vencedor */}
            {sport === 'Vôlei' && betType === 'vencedor' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Vencedor</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('home')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'home'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Mandante</span>
                    <span className="truncate max-w-full font-semibold">{room.home_team}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('away')}
                    className={`h-14 rounded-lg font-bold text-xs transition-all border p-2 flex flex-col items-center justify-center ${
                      selectedWinner === 'away'
                        ? 'bg-primary/20 border-primary text-primary shadow-neon'
                        : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-on-surface/40">Visitante</span>
                    <span className="truncate max-w-full font-semibold">{room.away_team}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 8. Vôlei / Placar de Sets */}
            {sport === 'Vôlei' && betType === 'placar_sets' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Placar Exato de Sets (Melhor de 5)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['3x0', '3x1', '3x2', '2x3', '1x3', '0x3'].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setSelectedSetsScore(score)}
                      className={`h-12 rounded-lg font-bold text-xs transition-all border ${
                        selectedSetsScore === score
                          ? 'bg-primary/20 border-primary text-primary shadow-neon'
                          : 'bg-surface-container-low border-outline-variant text-on-surface/75 hover:bg-outline-variant/10'
                      }`}
                    >
                      {score} ({score.startsWith('3') ? room.home_team.split(' ')[0] : room.away_team.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Fórmula 1 / Vencedor Corrida */}
            {sport === 'Fórmula 1' && betType === 'vencedor_corrida' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Selecionar Vencedor da Corrida</label>
                <select
                  value={selectedF1Winner}
                  onChange={(e) => setSelectedF1Winner(e.target.value)}
                  disabled={submitLoading}
                  className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Selecione o Piloto --</option>
                  {(room.event_data?.competitors || []).map((driver: string, i: number) => (
                    <option key={i} value={driver}>{driver}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 10. Fórmula 1 / Pódio (Top 3) */}
            {sport === 'Fórmula 1' && betType === 'podio' && (
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Seu Pódio (Top 3)</label>
                <div className="flex flex-col gap-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-primary uppercase">1º Colocado (Vencedor)</span>
                    <select
                      value={podium1}
                      onChange={(e) => setPodium1(e.target.value)}
                      disabled={submitLoading}
                      className="h-11 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Selecione o 1º --</option>
                      {(room.event_data?.competitors || [])
                        .filter((d: string) => d !== podium2 && d !== podium3)
                        .map((driver: string, i: number) => (
                          <option key={i} value={driver}>{driver}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-on-surface/60 uppercase">2º Colocado</span>
                    <select
                      value={podium2}
                      onChange={(e) => setPodium2(e.target.value)}
                      disabled={submitLoading}
                      className="h-11 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Selecione o 2º --</option>
                      {(room.event_data?.competitors || [])
                        .filter((d: string) => d !== podium1 && d !== podium3)
                        .map((driver: string, i: number) => (
                          <option key={i} value={driver}>{driver}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-on-surface/60 uppercase">3º Colocado</span>
                    <select
                      value={podium3}
                      onChange={(e) => setPodium3(e.target.value)}
                      disabled={submitLoading}
                      className="h-11 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Selecione o 3º --</option>
                      {(room.event_data?.competitors || [])
                        .filter((d: string) => d !== podium1 && d !== podium2)
                        .map((driver: string, i: number) => (
                          <option key={i} value={driver}>{driver}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-2">
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
                    const digits = val.replace(/\D/g, '').slice(0, 11);
                    val = digits.replace(/(\d{3})(\d)/, '$1.$2')
                               .replace(/(\d{3})(\d)/, '$1.$2')
                               .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
                  } else if (pixKeyType === 'phone') {
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
