import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import QRCode from 'qrcode';

interface Room {
  id: string;
  title: string;
  home_team: string;
  away_team: string;
  valor_da_cota: number;
  horario_limite: string | null;
  pix_key: string;
  pix_key_type: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  creator_id: string;
  sport?: string;
  bet_type?: string;
  event_data?: any;
  regra_banca_comissionada?: boolean;
  comissao_porcentagem?: number;
  reembolso_token?: boolean;
  custo_do_token?: number;
}

interface Guess {
  id: string;
  bettor_name: string;
  bettor_pix_key: string;
  home_score: number | null;
  away_score: number | null;
  dynamic_cents: number;
  final_value: number;
  payment_status: 'pending' | 'confirmed';
  guess_data?: any;
  created_at?: string;
}

export default function LiveDashboard() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Dynamic font size scaling for large screens/TVs
  useEffect(() => {
    const adjustFontSize = () => {
      if (window.innerWidth >= 1024) {
        const baseWidth = 1920;
        const scale = window.innerWidth / baseWidth;
        // Cap base font size between 12px and 36px to prevent extreme scaling
        const targetSize = Math.max(12, Math.min(36, scale * 16));
        document.documentElement.style.fontSize = `${targetSize}px`;
      } else {
        document.documentElement.style.fontSize = '';
      }
    };

    adjustFontSize();
    window.addEventListener('resize', adjustFontSize);

    return () => {
      window.removeEventListener('resize', adjustFontSize);
      document.documentElement.style.fontSize = '';
    };
  }, []);

  // Autoscroll effect for TV screens
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    let animationFrameId: number;
    let scrollSpeed = 0.4; // pixels per frame
    let delayTimeout: any = null;
    let isWaiting = false;

    const scroll = () => {
      if (isHovered) {
        animationFrameId = requestAnimationFrame(scroll);
        return;
      }

      if (listEl.scrollHeight > listEl.clientHeight) {
        if (isWaiting) {
          animationFrameId = requestAnimationFrame(scroll);
          return;
        }

        listEl.scrollTop += scrollSpeed;

        if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 1) {
          isWaiting = true;
          delayTimeout = setTimeout(() => {
            listEl.scrollTo({ top: 0, behavior: 'smooth' });
            delayTimeout = setTimeout(() => {
              isWaiting = false;
            }, 3000);
          }, 3000);
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    delayTimeout = setTimeout(() => {
      animationFrameId = requestAnimationFrame(scroll);
    }, 2000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (delayTimeout) clearTimeout(delayTimeout);
    };
  }, [guesses, isHovered]);

  // URL para realizar o palpite
  const bettorUrl = `${window.location.origin}/resenha/${id}`;

  // Buscar dados iniciais da sala e palpites
  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // Buscar sala
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
      setRoom(roomData);

      // Buscar palpites
      const { data: guessesData, error: guessesError } = await supabase
        .from('guesses')
        .select('*')
        .eq('room_id', id)
        .order('dynamic_cents', { ascending: true });

      if (guessesError) {
        console.error('Erro ao buscar palpites:', guessesError);
      } else {
        setGuesses(guessesData || []);
      }

      // Gerar QR Code
      try {
        const qrDataUrl = await QRCode.toDataURL(bettorUrl, {
          width: 600,
          margin: 2,
          color: {
            dark: '#04140a',  // Verde escuro da identidade visual do app
            light: '#ffffff'
          }
        });
        setQrCodeBase64(qrDataUrl);
      } catch (qrErr) {
        console.error('Erro ao gerar QR Code:', qrErr);
      }

    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Supabase Realtime: Sincronização em tempo real
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`live-dashboard-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guesses',
          filter: `room_id=eq.${id}`
        },
        (payload) => {
          console.debug('Atualização de palpite recebida:', payload);
          if (payload.eventType === 'INSERT') {
            const newGuess = payload.new as Guess;
            setGuesses((prev) => {
              if (prev.some((g) => g.id === newGuess.id)) return prev;
              return [...prev, newGuess].sort((a, b) => a.dynamic_cents - b.dynamic_cents);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedGuess = payload.new as Guess;
            setGuesses((prev) =>
              prev.map((g) => (g.id === updatedGuess.id ? updatedGuess : g))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedGuess = payload.old as { id: string };
            setGuesses((prev) => prev.filter((g) => g.id !== deletedGuess.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.debug('Atualização de sala recebida:', payload);
          setRoom(payload.new as Room);
        }
      )
      .subscribe((status) => {
        console.debug('Supabase Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Countdown timer para o limite de apostas
  useEffect(() => {
    if (!room || !room.horario_limite) {
      setTimeLeft('Sem prazo definido');
      setIsExpired(false);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(room.horario_limite!) - +new Date();
      if (difference <= 0) {
        setTimeLeft('Prazo Expirado');
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const formattedSeconds = seconds.toString().padStart(2, '0');

      setTimeLeft(`${formattedHours}:${formattedMinutes}:${formattedSeconds}`);
      setIsExpired(false);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [room]);

  // Checar se as apostas estão encerradas (por status ou horário)
  const isBettingClosed = () => {
    if (!room) return true;
    if (room.status !== 'active') return true;
    if (isExpired) return true;
    return false;
  };

  // Formatar palpite com base no esporte
  const renderGuessSummary = (guess: Guess) => {
    if (!room) return '';
    const sport = room.sport || 'Futebol';
    const betType = room.bet_type || 'placar_exato';
    const g = guess.guess_data || {};

    if (sport === 'Futebol') {
      if (betType === 'placar_exato') {
        return `${guess.home_score} x ${guess.away_score}`;
      } else {
        const winnerName = g.winner === 'home' ? room.home_team : g.winner === 'draw' ? 'Empate' : room.away_team;
        return `Vencedor: ${winnerName}`;
      }
    } else if (sport === 'Tênis') {
      const playerA = room.event_data?.player_a || room.home_team;
      const playerB = room.event_data?.player_b || room.away_team;
      if (betType === 'vencedor') {
        return `Vencedor: ${g.winner === 'player_a' ? playerA : playerB}`;
      } else {
        return `Sets: ${g.sets_score}`;
      }
    } else if (sport === 'Basquete') {
      if (betType === 'vencedor') {
        const winnerName = g.winner === 'home' ? room.home_team : room.away_team;
        return `Vencedor: ${winnerName}`;
      } else {
        const line = room.event_data?.line || '210.5';
        return `Total: ${g.over_under === 'over' ? 'Mais de' : 'Menos de'} ${line}`;
      }
    } else if (sport === 'Vôlei') {
      if (betType === 'vencedor') {
        const winnerName = g.winner === 'home' ? room.home_team : room.away_team;
        return `Vencedor: ${winnerName}`;
      } else {
        return `Sets: ${g.sets_score}`;
      }
    } else if (sport === 'Fórmula 1') {
      if (betType === 'vencedor_corrida') {
        return `Vencedor: ${g.winner || 'Não definido'}`;
      } else {
        const p = g.podium || [];
        return `Pódio: ${p.slice(0, 3).join(' • ')}`;
      }
    }
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04140a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ffdf00] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-display font-bold text-[#ffdf00] tracking-wide animate-pulse">Carregando painel ao vivo...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#04140a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#082112] border border-red-500/30 rounded-2xl p-6 text-center shadow-lg">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-display font-bold text-lg text-on-surface mb-2">Erro ao carregar</h3>
          <p className="text-on-surface/75 text-sm mb-6">{error || 'Sala não encontrada.'}</p>
          <Link to="/dashboard" className="inline-flex items-center justify-center px-6 h-11 bg-[#ffdf00] hover:bg-[#ffdf00]/90 text-[#04140a] font-display font-bold rounded-xl transition-all shadow-md">
            Voltar para o Painel
          </Link>
        </div>
      </div>
    );
  }

  const closed = isBettingClosed();
  const confirmedGuesses = guesses.filter(g => g.payment_status === 'confirmed');

  // Calculate prize pool with room rule discounts
  const totalPool = confirmedGuesses.length * (room.valor_da_cota ?? 0);
  const refundValue = (room.reembolso_token && room.custo_do_token) ? room.custo_do_token : 0;
  const poolAfterRefund = Math.max(0, totalPool - refundValue);
  const commissionValue = (room.regra_banca_comissionada && room.comissao_porcentagem) 
    ? Math.round(poolAfterRefund * (room.comissao_porcentagem / 100) * 100) / 100 
    : 0;
  const netPool = Math.max(0, poolAfterRefund - commissionValue);

  return (
    <div className="dark h-screen bg-[#04140a] text-[#f8f9fa] font-body flex flex-col antialiased selection:bg-[#ffdf00] selection:text-[#04140a] overflow-hidden">
      {/* Top Header */}
      <header className="bg-[#082112] border-b border-[#009b3a]/20 px-6 py-4 flex items-center justify-between shadow-md h-16 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="https://resenhabet.app/assets/apple-touch-icon.png" alt="Resenha Bet Logo" className="w-10 h-10 rounded-lg object-cover border border-[#009b3a]/30 shadow-sm" />
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[#f8f9fa] flex items-center gap-2">
              Resenha Bet
              <span className="hidden sm:inline-block text-[10px] uppercase bg-[#ffdf00]/10 text-[#ffdf00] px-2 py-0.5 rounded border border-[#ffdf00]/20 font-bold tracking-wider">
                TV Screen
              </span>
            </h1>
            <p className="text-xs text-on-surface/60 font-semibold">{room.sport || 'Futebol'} • {room.bet_type === 'placar_exato' ? 'Placar Exato' : 'Vencedor / Outros'}</p>
          </div>
        </div>

        {/* Live Indicator */}
        <div className="flex items-center gap-2.5 bg-[#009b3a]/10 border border-[#009b3a]/30 px-3.5 py-1.5 rounded-full shadow-inner">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
          <span className="text-xs font-display font-extrabold tracking-widest text-[#f8f9fa]">AO VIVO</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 lg:p-6 pb-8 lg:pb-12 flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6 max-w-[1600px] w-full mx-auto min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left Side: QR Code & Status */}
        <div className="lg:h-full lg:flex lg:flex-col gap-4 lg:gap-6 lg:col-span-1 grid grid-cols-1 md:grid-cols-2">
          {/* QR Code Card */}
          <div className="bg-[#082112] border border-[#009b3a]/10 rounded-3xl p-4 lg:p-6 flex flex-row lg:flex-col lg:flex-1 lg:min-h-0 items-center justify-between lg:justify-center text-left lg:text-center shadow-floating transition-all duration-300 hover:border-[#009b3a]/30 gap-4">
            <div className="flex-1 min-w-0 lg:flex lg:flex-col lg:justify-center lg:items-center">
              <h2 className="font-display font-extrabold text-[#ffdf00] text-sm lg:text-lg mb-1 uppercase tracking-wide">
                Faça sua Aposta!
              </h2>
              <p className="text-[10px] lg:text-xs text-on-surface/70 mb-3 lg:mb-5 max-w-[220px] hidden md:block">
                Aponte a câmera do seu celular para o QR Code ao lado e envie seu palpite.
              </p>
              <div className="hidden md:block bg-[#04140a] px-3 py-1.5 rounded-xl border border-[#009b3a]/15 max-w-full truncate text-[10px] lg:text-xs font-mono select-all shadow-inner text-[#ffdf00]/95">
                {bettorUrl.replace('https://', '').replace('http://', '')}
              </div>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-neon border border-[#ffdf00]/20 flex-shrink-0 lg:mt-4">
              {qrCodeBase64 ? (
                <img src={qrCodeBase64} alt="Link de apostas da resenha" className="w-20 h-20 sm:w-24 sm:h-24 lg:w-56 lg:h-56 object-contain" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-56 lg:h-56 flex items-center justify-center text-on-surface/40 text-[10px]">
                  Gerando...
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-[#082112] border border-[#009b3a]/10 rounded-3xl p-4 lg:p-6 flex flex-col lg:flex-1 lg:min-h-0 lg:justify-between gap-3 lg:gap-5 shadow-floating">
            <h3 className="hidden md:block font-display font-bold text-xs lg:text-sm uppercase text-on-surface/60 tracking-wider">Informações da Sala</h3>
            
            {/* Event Name */}
            <div className="flex flex-col md:flex-row lg:flex-col justify-between items-start lg:items-stretch min-w-0">
              <div>
                <p className="text-[9px] lg:text-[10px] text-on-surface/50 font-bold uppercase tracking-wider">Resenha</p>
                <h4 className="font-display font-extrabold text-base lg:text-lg text-on-surface leading-tight mt-0.5 truncate max-w-[150px] sm:max-w-none">
                  {room.title}
                </h4>
              </div>
              {room.home_team && room.away_team && (
                <p className="text-xs lg:text-sm font-semibold text-[#ffdf00] mt-1 self-start md:self-center lg:self-auto">
                  {room.home_team} vs {room.away_team}
                </p>
              )}
            </div>

            {/* Pote de Prêmios */}
            <div className="bg-[#04140a] p-3 lg:p-4 rounded-2xl border-2 border-[#ffdf00]/30 shadow-neon flex flex-col justify-center items-center text-center">
              <p className="text-[9px] lg:text-[10px] text-[#ffdf00] font-extrabold uppercase tracking-wider mb-0.5">Pote do Prêmio</p>
              <div className="font-display font-black text-xl lg:text-3xl text-[#ffdf00] tracking-wide">
                R$ {Number(netPool).toFixed(2)}
              </div>
              {(room.regra_banca_comissionada && room.comissao_porcentagem) && (
                <p className="text-[8px] lg:text-[9px] text-on-surface/40 mt-0.5 uppercase font-semibold">
                  (Comissão de {room.comissao_porcentagem}% aplicada)
                </p>
              )}
            </div>

            {/* Entry Fee & Confirmed & Status */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-2 lg:gap-4">
              <div className="bg-[#04140a] p-2 lg:p-3 rounded-2xl border border-[#009b3a]/10 flex flex-col justify-center items-center text-center">
                <p className="text-[8px] lg:text-[9px] text-on-surface/50 font-bold uppercase tracking-wider">Cota</p>
                <p className="font-display font-extrabold text-xs lg:text-base text-[#ffdf00] mt-0.5">
                  R$ {Number(room.valor_da_cota).toFixed(2)}
                </p>
              </div>
              <div className="bg-[#04140a] p-2 lg:p-3 rounded-2xl border border-[#009b3a]/10 flex flex-col justify-center items-center text-center">
                <p className="text-[8px] lg:text-[9px] text-on-surface/50 font-bold uppercase tracking-wider">Confirmados</p>
                <p className="font-display font-extrabold text-xs lg:text-base text-[#f8f9fa] mt-0.5">
                  {confirmedGuesses.length} / {guesses.length}
                </p>
              </div>
              <div className="hidden md:flex bg-[#04140a] p-2 lg:p-3 rounded-2xl border border-[#009b3a]/10 col-span-1 md:col-span-1 lg:col-span-2 flex-col justify-center items-center text-center">
                <p className="text-[8px] lg:text-[9px] text-on-surface/50 font-bold uppercase tracking-wider">Status</p>
                {room.status === 'active' && !isExpired ? (
                  <div className="font-display font-extrabold text-xs lg:text-lg text-[#ffdf00] tracking-wider truncate">
                    {timeLeft}
                  </div>
                ) : (
                  <div className="font-display font-extrabold text-xs lg:text-sm text-red-500 uppercase tracking-wide">
                    FECHADO
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Bettors List */}
        <div className="flex-1 min-h-0 lg:col-span-2 flex flex-col bg-[#082112] border border-[#009b3a]/10 rounded-3xl shadow-floating overflow-hidden lg:h-full">
          <div className="px-6 py-5 border-b border-[#009b3a]/15 bg-[#082112] flex items-center justify-between flex-shrink-0">
            <h2 className="font-display font-extrabold text-lg text-on-surface tracking-tight flex items-center gap-2.5">
              Participantes
              <span className="bg-[#ffdf00] text-[#04140a] font-mono text-xs px-2.5 py-0.5 rounded-full font-bold">
                {guesses.length}
              </span>
            </h2>
            <div className="text-xs text-on-surface/60 font-semibold">
              {closed ? (
                <span className="text-[#ffdf00] flex items-center gap-1.5 font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Palpites Revelados
                </span>
              ) : (
                <span className="text-green-400 flex items-center gap-1.5 font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Palpites Ocultos (🔒)
                </span>
              )}
            </div>
          </div>

          {/* List Wrapper */}
          <div 
            ref={listRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex-1 overflow-y-auto p-4 lg:p-6"
          >
            {guesses.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-on-surface/40 py-16">
                <svg className="w-16 h-16 text-on-surface/20 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="font-display font-bold text-base text-on-surface/50">Nenhum palpite enviado ainda</p>
                <p className="text-xs text-on-surface/40 mt-1 max-w-[280px]">Os palpites enviados aparecerão aqui em tempo real assim que forem gerados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guesses.map((guess) => {
                  const isPaid = guess.payment_status === 'confirmed';
                  return (
                    <div
                      key={guess.id}
                      className={`flex flex-col justify-between p-4 rounded-2xl border transition-all duration-300 transform hover:scale-[1.01] ${
                        isPaid 
                          ? 'bg-[#009b3a]/5 border-[#009b3a]/20 hover:border-[#009b3a]/45' 
                          : 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Initial Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-xs shadow-sm flex-shrink-0 ${
                          isPaid ? 'bg-[#009b3a]/25 text-[#ffdf00]' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {guess.bettor_name[0].toUpperCase()}
                        </div>

                        {/* Name */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display font-bold text-sm text-[#f8f9fa] truncate">
                            {guess.bettor_name}
                          </h4>
                        </div>

                        {/* Payment Badge */}
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-md border flex-shrink-0 tracking-wider shadow-sm ${
                          isPaid 
                            ? 'bg-[#009b3a]/15 text-[#009b3a] border-[#009b3a]/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                        }`}>
                          {isPaid ? 'Pago' : 'Pendente'}
                        </span>
                      </div>

                      {/* Prediction Result Section */}
                      <div className="mt-3.5 pt-3 border-t border-[#009b3a]/10 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-on-surface/60 font-semibold">Palpite:</span>
                        {closed ? (
                          <span className="font-display font-black text-sm text-[#ffdf00] tracking-wide bg-[#04140a] px-3 py-1 rounded-lg border border-[#009b3a]/15">
                            {renderGuessSummary(guess)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-on-surface/40 bg-[#04140a] px-2.5 py-1 rounded-lg border border-[#009b3a]/10 flex items-center gap-1.5 italic">
                            <svg className="w-3.5 h-3.5 text-[#ffdf00]/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            Oculto
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
