import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

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
  home_score: number | null;
  away_score: number | null;
  creator_id: string;
  sport?: string;
  bet_type?: string;
  event_data?: any;
}

interface Guess {
  id: string;
  bettor_name: string;
  bettor_pix_key: string;
  home_score: number;
  away_score: number;
  dynamic_cents: number;
  final_value: number;
  payment_status: 'pending' | 'confirmed';
  guess_data?: any;
}

interface Winner {
  winner_name: string;
  winner_pix_key: string;
  prize_value: number;
}

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Score inputs
  const [homeScoreInput, setHomeScoreInput] = useState('');
  const [awayScoreInput, setAwayScoreInput] = useState('');

  // F1 result inputs
  const [f1WinnerInput, setF1WinnerInput] = useState('');
  const [f1Podium1, setF1Podium1] = useState('');
  const [f1Podium2, setF1Podium2] = useState('');
  const [f1Podium3, setF1Podium3] = useState('');

  const fetchData = async () => {
    if (!id || !user) return;

    try {
      // 1. Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (roomError || !roomData) {
        setError('Resenha não encontrada.');
        setLoading(false);
        return;
      }

      // Check ownership
      if (roomData.creator_id !== user.id) {
        setError('Você não tem permissão para gerenciar esta resenha.');
        setLoading(false);
        return;
      }

      setRoom(roomData);

      // 2. Fetch guesses
      const { data: guessesData, error: guessesError } = await supabase
        .from('guesses')
        .select('*')
        .eq('room_id', id)
        .order('dynamic_cents', { ascending: true });

      if (guessesError) {
        console.error('Error fetching guesses:', guessesError);
      } else {
        setGuesses(guessesData || []);
      }

      // 3. If room is already settled, get winners
      if (roomData.status === 'settled') {
        const homeOfficial = roomData.home_score;
        const awayOfficial = roomData.away_score;
        const sport = roomData.sport || 'Futebol';
        const betType = roomData.bet_type || 'placar_exato';

        // Count confirmed & correct guesses
        const correctGuesses = (guessesData || []).filter((g) => {
          if (g.payment_status !== 'confirmed') return false;

          if (sport === 'Futebol') {
            if (betType === 'placar_exato') {
              return g.home_score === homeOfficial && g.away_score === awayOfficial;
            } else {
              if (homeOfficial === null || awayOfficial === null) return false;
              const officialWinner = homeOfficial > awayOfficial ? 'home' : homeOfficial === awayOfficial ? 'draw' : 'away';
              return g.guess_data?.winner === officialWinner;
            }
          } else if (sport === 'Tênis') {
            if (betType === 'vencedor') {
              if (homeOfficial === null || awayOfficial === null) return false;
              const officialWinner = homeOfficial > awayOfficial ? 'player_a' : 'player_b';
              return g.guess_data?.winner === officialWinner;
            } else {
              return g.guess_data?.sets_score === `${homeOfficial}x${awayOfficial}`;
            }
          } else if (sport === 'Basquete') {
            if (betType === 'vencedor') {
              if (homeOfficial === null || awayOfficial === null) return false;
              const officialWinner = homeOfficial > awayOfficial ? 'home' : 'away';
              return g.guess_data?.winner === officialWinner;
            } else {
              if (homeOfficial === null || awayOfficial === null) return false;
              const total = homeOfficial + awayOfficial;
              const line = Number(roomData.event_data?.line);
              const officialResult = total > line ? 'over' : 'under';
              return g.guess_data?.over_under === officialResult;
            }
          } else if (sport === 'Vôlei') {
            if (betType === 'vencedor') {
              if (homeOfficial === null || awayOfficial === null) return false;
              const officialWinner = homeOfficial > awayOfficial ? 'home' : 'away';
              return g.guess_data?.winner === officialWinner;
            } else {
              return g.guess_data?.sets_score === `${homeOfficial}x${awayOfficial}`;
            }
          } else if (sport === 'Fórmula 1') {
            if (betType === 'vencedor_corrida') {
              return g.guess_data?.winner === roomData.event_data?.result?.winner;
            } else {
              return JSON.stringify(g.guess_data?.podium) === JSON.stringify(roomData.event_data?.result?.podium);
            }
          }
          return false;
        });

        const totalConfirmed = (guessesData || []).filter((g) => g.payment_status === 'confirmed').length;
        const totalPool = totalConfirmed * roomData.valor_da_cota;

        if (correctGuesses.length > 0) {
          const prizePerWinner = Math.round((totalPool / correctGuesses.length) * 100) / 100;
          const mappedWinners = correctGuesses.map((g) => ({
            winner_name: g.bettor_name,
            winner_pix_key: g.bettor_pix_key,
            prize_value: prizePerWinner,
          }));
          setWinners(mappedWinners);
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados do relatório.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const handleConfirmPayment = async (guessId: string) => {
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('guesses')
        .update({ payment_status: 'confirmed' })
        .eq('id', guessId);

      if (updateError) {
        alert(updateError.message);
      } else {
        setGuesses((prev) =>
          prev.map((g) => (g.id === guessId ? { ...g, payment_status: 'confirmed' } : g))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar pagamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !room) return;

    let homeVal: number | null = null;
    let awayVal: number | null = null;
    let resultData: any = null;

    const sport = room.sport || 'Futebol';
    const betType = room.bet_type || 'placar_exato';

    if (sport === 'Fórmula 1') {
      if (betType === 'vencedor_corrida') {
        if (!f1WinnerInput) {
          alert('Por favor, selecione o piloto vencedor.');
          return;
        }
        resultData = { winner: f1WinnerInput };
      } else if (betType === 'podio') {
        if (!f1Podium1 || !f1Podium2 || !f1Podium3) {
          alert('Por favor, selecione os 3 pilotos do pódio.');
          return;
        }
        if (f1Podium1 === f1Podium2 || f1Podium1 === f1Podium3 || f1Podium2 === f1Podium3) {
          alert('Os pilotos do pódio não podem se repetir.');
          return;
        }
        resultData = { podium: [f1Podium1, f1Podium2, f1Podium3] };
      }
    } else {
      if (!homeScoreInput.trim() || !awayScoreInput.trim()) {
        alert('Por favor, informe o placar oficial da partida.');
        return;
      }

      homeVal = parseInt(homeScoreInput);
      awayVal = parseInt(awayScoreInput);

      if (isNaN(homeVal) || homeVal < 0 || isNaN(awayVal) || awayVal < 0) {
        alert('Placar inválido.');
        return;
      }

      if (sport === 'Basquete' && betType === 'pontos_total') {
        resultData = { line: room.event_data?.line };
      }
    }

    if (confirm('Deseja realmente encerrar a sala e ratear o prêmio? Esta ação é irreversível.')) {
      setActionLoading(true);
      setError(null);

      try {
        const { data, error: settleError } = await supabase.rpc('settle_room', {
          p_room_id: id,
          p_home_score: homeVal,
          p_away_score: awayVal,
          p_result_data: resultData,
        });

        if (settleError) {
          setError(settleError.message);
        } else {
          setWinners(data || []);
          // Reload room to update status and scores in view
          const { data: updatedRoom } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', id)
            .single();
          if (updatedRoom) {
            setRoom(updatedRoom);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao liquidar a resenha.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const renderGuessSummary = (g: Guess) => {
    const sport = room?.sport || 'Futebol';
    const betType = room?.bet_type || 'placar_exato';
    const gd = g.guess_data || {};

    if (sport === 'Futebol') {
      if (betType === 'placar_exato') {
        return `(${g.home_score} x ${g.away_score})`;
      } else {
        const text = gd.winner === 'home' ? room?.home_team : gd.winner === 'draw' ? 'Empate' : room?.away_team;
        return `(${text})`;
      }
    } else if (sport === 'Tênis') {
      const playerA = room?.event_data?.player_a || room?.home_team;
      const playerB = room?.event_data?.player_b || room?.away_team;
      if (betType === 'vencedor') {
        const text = gd.winner === 'player_a' ? playerA : playerB;
        return `(${text})`;
      } else {
        return `(${gd.sets_score})`;
      }
    } else if (sport === 'Basquete') {
      if (betType === 'vencedor') {
        const text = gd.winner === 'home' ? room?.home_team : room?.away_team;
        return `(${text})`;
      } else {
        return `(${gd.over_under === 'over' ? 'Over' : 'Under'} ${room?.event_data?.line})`;
      }
    } else if (sport === 'Vôlei') {
      if (betType === 'vencedor') {
        const text = gd.winner === 'home' ? room?.home_team : room?.away_team;
        return `(${text})`;
      } else {
        return `(${gd.sets_score})`;
      }
    } else if (sport === 'Fórmula 1') {
      if (betType === 'vencedor_corrida') {
        return `(${gd.winner})`;
      } else {
        const pod = gd.podium || [];
        return `(1º: ${pod[0] || '-'}, 2º: ${pod[1] || '-'}, 3º: ${pod[2] || '-'})`;
      }
    }
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_var(--loader-shadow)]" />
        <p className="font-display text-sm font-bold text-on-surface/60 uppercase tracking-widest animate-pulse">
          Carregando Relatório...
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
        <Link to="/dashboard" className="text-primary font-bold hover:underline">
          Voltar para o Painel
        </Link>
      </div>
    );
  }

  const confirmedGuesses = guesses.filter((g) => g.payment_status === 'confirmed');
  const totalConfirmed = confirmedGuesses.length;
  const totalPool = totalConfirmed * (room?.valor_da_cota ?? 0);

  const isSettled = room?.status === 'settled';

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      <div>
        <Link to="/dashboard" className="text-primary font-bold hover:underline">
          ← Voltar ao Painel
        </Link>
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold text-on-surface">Relatório &amp; Rateio</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {room && (
        <>
          {/* Match Result Header */}
          <div className="bg-surface-container-low p-5 rounded-xl flex flex-col items-center gap-3 border border-outline-variant-raw/10">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isSettled ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'
            }`}>
              {room.sport || 'Futebol'} · {isSettled ? 'Encerrado' : 'Em Andamento'}
            </span>
            {room.sport === 'Fórmula 1' ? (
              <div className="text-center w-full">
                <p className="font-display font-bold text-on-surface text-lg">{room.event_data?.gp_name || room.home_team}</p>
                {isSettled && (
                  <div className="mt-3 p-3 bg-surface-container-highest rounded-lg border border-outline-variant/10 text-center">
                    {room.bet_type === 'vencedor_corrida' ? (
                      <p className="text-xs text-on-surface">Vencedor Oficial: <span className="font-bold text-primary">{room.event_data?.result?.winner}</span></p>
                    ) : (
                      <p className="text-xs text-on-surface">Pódio Oficial: <span className="font-bold text-primary">{(room.event_data?.result?.podium || []).join(' → ')}</span></p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="font-display font-bold text-on-surface text-lg">{room.home_team}</p>
                  {isSettled ? (
                    <p className="font-display font-bold text-primary text-4xl mt-1">{room.home_score}</p>
                  ) : (
                    <p className="font-display font-bold text-on-surface/40 text-4xl mt-1">-</p>
                  )}
                </div>
                <span className="text-on-surface/40 font-display font-bold text-xl">×</span>
                <div className="text-center">
                  <p className="font-display font-bold text-on-surface text-lg">{room.away_team}</p>
                  {isSettled ? (
                    <p className="font-display font-bold text-primary text-4xl mt-1">{room.away_score}</p>
                  ) : (
                    <p className="font-display font-bold text-on-surface/40 text-4xl mt-1">-</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Conciliation Data Summary */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-surface-container p-5 rounded-xl flex flex-col gap-3">
              <h3 className="font-display text-lg font-bold text-on-surface">Resumo da Sala</h3>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant-raw/10">
                <span className="text-sm text-on-surface/60">Pote total (Confirmado)</span>
                <span className="font-display font-bold text-primary">R$ {totalPool.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant-raw/10">
                <span className="text-sm text-on-surface/60">Total de Palpites</span>
                <span className="font-display font-bold text-on-surface">{guesses.length} palpites ({totalConfirmed} pagos)</span>
              </div>
              {isSettled && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-on-surface/60">Acertadores</span>
                  <span className="font-display font-bold text-primary">{winners.length} acertadores</span>
                </div>
              )}
            </div>

            {/* If SETTLED: show Winners list */}
            {isSettled ? (
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-lg font-bold text-on-surface">
                  Rateio ({winners.length > 0 ? `R$ ${(totalPool / winners.length).toFixed(2).replace('.', ',')} por acertador` : 'Sem acertadores'})
                </h3>
                
                {winners.length === 0 ? (
                  <div className="bg-surface-container-low p-6 rounded-xl border border-dashed border-outline-variant text-center py-8">
                    <p className="text-sm text-on-surface/50">Ninguém acertou o resultado oficial ou as cotas não foram pagas.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {winners.map((winner, idx) => (
                      <div key={idx} className="bg-surface-container p-4 rounded-xl flex justify-between items-center border border-outline-variant-raw/10">
                        <div>
                          <p className="font-display font-bold text-on-surface">{winner.winner_name}</p>
                          <p className="text-xs text-on-surface/60 mt-0.5">PIX: {winner.winner_pix_key}</p>
                        </div>
                        <span className="font-display font-bold text-primary">R$ {Number(winner.prize_value).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* If ACTIVE: show Settle Form & Guesses Management list */
              <div className="flex flex-col gap-6">
                <form onSubmit={handleSettle} className="bg-surface-container p-5 rounded-xl flex flex-col gap-4">
                  <h3 className="font-display text-lg font-bold text-on-surface">Encerrar Resenha</h3>
                  <p className="text-xs text-on-surface/60">
                    Insira o resultado oficial do evento para calcular os vencedores e dividir o pote.
                  </p>
                  
                  {room.sport === 'Fórmula 1' ? (
                    room.bet_type === 'vencedor_corrida' ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Vencedor Oficial</label>
                        <select
                          value={f1WinnerInput}
                          onChange={(e) => setF1WinnerInput(e.target.value)}
                          disabled={actionLoading}
                          className="h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                        >
                          <option value="">-- Selecione o Vencedor --</option>
                          {(room.event_data?.competitors || []).map((driver: string, i: number) => (
                            <option key={i} value={driver}>{driver}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Pódio Oficial (Top 3)</label>
                        <div className="flex flex-col gap-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-primary uppercase">1º Lugar</span>
                            <select
                              value={f1Podium1}
                              onChange={(e) => setF1Podium1(e.target.value)}
                              disabled={actionLoading}
                              className="h-10 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                            >
                              <option value="">-- Selecione o 1º --</option>
                              {(room.event_data?.competitors || [])
                                .filter((d: string) => d !== f1Podium2 && d !== f1Podium3)
                                .map((driver: string, i: number) => (
                                  <option key={i} value={driver}>{driver}</option>
                                ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-on-surface/60 uppercase">2º Lugar</span>
                            <select
                              value={f1Podium2}
                              onChange={(e) => setF1Podium2(e.target.value)}
                              disabled={actionLoading}
                              className="h-10 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                            >
                              <option value="">-- Selecione o 2º --</option>
                              {(room.event_data?.competitors || [])
                                .filter((d: string) => d !== f1Podium1 && d !== f1Podium3)
                                .map((driver: string, i: number) => (
                                  <option key={i} value={driver}>{driver}</option>
                                ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-on-surface/60 uppercase">3º Lugar</span>
                            <select
                              value={f1Podium3}
                              onChange={(e) => setF1Podium3(e.target.value)}
                              disabled={actionLoading}
                              className="h-10 px-4 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-xs focus:outline-none focus:border-primary"
                            >
                              <option value="">-- Selecione o 3º --</option>
                              {(room.event_data?.competitors || [])
                                .filter((d: string) => d !== f1Podium1 && d !== f1Podium2)
                                .map((driver: string, i: number) => (
                                  <option key={i} value={driver}>{driver}</option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider text-center">{room.home_team}</label>
                        <input
                          type="number"
                          placeholder={room.sport === 'Basquete' ? 'Pontos' : room.sport === 'Tênis' || room.sport === 'Vôlei' ? 'Sets' : 'Gols'}
                          value={homeScoreInput}
                          onChange={(e) => setHomeScoreInput(e.target.value)}
                          disabled={actionLoading}
                          className="h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-center font-display text-lg text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider text-center">{room.away_team}</label>
                        <input
                          type="number"
                          placeholder={room.sport === 'Basquete' ? 'Pontos' : room.sport === 'Tênis' || room.sport === 'Vôlei' ? 'Sets' : 'Gols'}
                          value={awayScoreInput}
                          onChange={(e) => setAwayScoreInput(e.target.value)}
                          disabled={actionLoading}
                          className="h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-center font-display text-lg text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={actionLoading || totalConfirmed === 0}
                    className="w-full h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {actionLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        Processando Rateio...
                      </>
                    ) : (
                      'Encerrar e Pagar Vencedores'
                    )}
                  </button>
                </form>

                <div className="flex flex-col gap-3">
                  <h3 className="font-display text-lg font-bold text-on-surface">Validar Pagamentos Pix</h3>
                  
                  {guesses.length === 0 ? (
                    <div className="bg-surface-container-low p-6 rounded-xl border border-dashed border-outline-variant text-center py-8">
                      <p className="text-sm text-on-surface/50">Nenhum palpite enviado ainda.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {guesses.map((guess) => (
                        <div key={guess.id} className="bg-surface-container p-4 rounded-xl flex justify-between items-center border border-outline-variant-raw/10">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-display font-bold text-on-surface">{guess.bettor_name}</p>
                              <span className="text-xs text-on-surface/50 font-display">{renderGuessSummary(guess)}</span>
                            </div>
                            <p className="text-[10px] text-on-surface/50 mt-1 uppercase tracking-wider">Pix: {guess.bettor_pix_key}</p>
                            <p className="text-xs font-display font-bold text-primary mt-1">
                              Pagar Pix de: R$ {Number(guess.final_value).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          
                          <div>
                            {guess.payment_status === 'confirmed' ? (
                              <span className="text-xs font-bold text-primary px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                Pago
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConfirmPayment(guess.id)}
                                disabled={actionLoading}
                                className="h-9 px-3 bg-surface-container-highest hover:bg-primary/20 text-xs font-bold font-display rounded-lg text-on-surface border border-outline-variant-raw/30 active:scale-95 transition-all disabled:opacity-50"
                              >
                                Confirmar Pix
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
