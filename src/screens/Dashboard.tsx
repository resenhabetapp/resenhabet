import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import ShareResenhaModal from '../components/ShareResenhaModal';

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

interface Guess {
  id: string;
  room_id: string;
  bettor_name: string;
  bettor_pix_key: string;
  home_score: number | null;
  away_score: number | null;
  dynamic_cents: number;
  final_value: number;
  payment_status: string;
  created_at: string;
  guess_data?: any;
  rooms: {
    id: string;
    title: string;
    home_team: string;
    away_team: string;
    status: string;
    valor_da_cota: number;
    sport?: string;
    bet_type?: string;
    event_data?: any;
  } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'organizer' | 'bettor'>('organizer');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedRoomToShare, setSelectedRoomToShare] = useState<Room | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch rooms (as organizer)
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });

        if (roomsError) console.error('Error fetching rooms:', roomsError);
        else setRooms(roomsData || []);

        // Fetch guesses (as bettor)
        const { data: guessesData, error: guessesError } = await supabase
          .from('guesses')
          .select('*, rooms(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (guessesError) console.error('Error fetching guesses:', guessesError);
        else setGuesses(guessesData as any || []);

      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-outline-variant/15">
        <button
          onClick={() => setActiveTab('organizer')}
          className={`flex-1 py-3 text-center text-sm font-bold font-display border-b-2 transition-all ${
            activeTab === 'organizer'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface/50 hover:text-on-surface'
          }`}
        >
          Minhas Resenhas
        </button>
        <button
          onClick={() => setActiveTab('bettor')}
          className={`flex-1 py-3 text-center text-sm font-bold font-display border-b-2 transition-all ${
            activeTab === 'bettor'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface/50 hover:text-on-surface'
          }`}
        >
          Meus Palpites
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_10px_var(--loader-shadow)]" />
          </div>
        ) : activeTab === 'organizer' ? (
          // ABA ORGANIZADOR
          rooms.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-xl border border-dashed border-outline-variant text-center flex flex-col gap-3 justify-center items-center py-12">
              <p className="text-sm text-on-surface/50">Você ainda não criou nenhuma resenha.</p>
              <Link to="/create-room" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline">
                Criar Primeira Resenha →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {rooms.map((room) => (
                <div key={room.id} className="bg-surface-container p-5 rounded-xl flex flex-col gap-3 border border-outline-variant/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        room.status === 'active' ? 'bg-primary/20 text-primary' : 
                        room.status === 'closed' ? 'bg-on-surface/20 text-on-surface/60' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {room.status === 'active' ? 'Ativa' : room.status === 'closed' ? 'Fechada' : 'Encerrada'}
                      </span>
                      <h4 className="font-display text-lg font-bold text-on-surface mt-2">{room.title}</h4>
                      <p className="text-xs text-on-surface/60 mt-0.5 font-medium">
                        {room.sport ? `[${room.sport}] ` : ''}
                        {room.sport === 'Fórmula 1'
                          ? (room.event_data?.gp_name || room.home_team)
                          : `${room.home_team} × ${room.away_team}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface/40 uppercase tracking-wider">Valor da Aposta</p>
                      <p className="font-display font-bold text-primary">R$ {Number(room.valor_da_cota).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2 pt-3 border-t border-outline-variant/10">
                    <Link
                      to={`/resenha/${room.id}/report`}
                      className="flex-1 h-9 bg-surface-container-highest hover:bg-outline-variant/20 rounded-lg flex items-center justify-center text-xs font-bold text-on-surface transition-colors"
                    >
                      Relatório &amp; Rateio
                    </Link>
                    {room.status !== 'settled' && (
                      <button
                        onClick={() => {
                          setSelectedRoomToShare(room);
                          setShareModalOpen(true);
                        }}
                        className="px-3 h-9 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                        title="Copiar Link de Convite"
                      >
                        Compartilhar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // ABA APOSTADOR
          guesses.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-xl border border-dashed border-outline-variant text-center flex flex-col gap-3 justify-center items-center py-12">
              <p className="text-sm text-on-surface/50">Você ainda não enviou nenhum palpite.</p>
              <p className="text-xs text-on-surface/40 max-w-[250px] mx-auto">
                Acesse o link enviado por um amigo organizador para palpitar em uma resenha!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {guesses.map((guess) => {
                const roomData = guess.rooms;
                if (!roomData) return null;

                const renderGuessDescription = () => {
                  const sport = roomData.sport || 'Futebol';
                  const betType = roomData.bet_type || 'placar_exato';
                  const g = guess.guess_data || {};

                  if (sport === 'Futebol') {
                    if (betType === 'placar_exato') {
                      return `${roomData.home_team} ${guess.home_score} × ${guess.away_score} ${roomData.away_team}`;
                    } else {
                      const winnerText = g.winner === 'home' ? roomData.home_team : g.winner === 'draw' ? 'Empate' : roomData.away_team;
                      return `Vencedor: ${winnerText}`;
                    }
                  } else if (sport === 'Tênis') {
                    const playerA = roomData.event_data?.player_a || roomData.home_team;
                    const playerB = roomData.event_data?.player_b || roomData.away_team;
                    if (betType === 'vencedor') {
                      const winnerText = g.winner === 'player_a' ? playerA : playerB;
                      return `Vencedor: ${winnerText}`;
                    } else {
                      return `Placar de Sets: ${g.sets_score}`;
                    }
                  } else if (sport === 'Basquete') {
                    if (betType === 'vencedor') {
                      const winnerText = g.winner === 'home' ? roomData.home_team : roomData.away_team;
                      return `Vencedor: ${winnerText}`;
                    } else {
                      const line = roomData.event_data?.line || '210.5';
                      return `Total: ${g.over_under === 'over' ? 'Mais de (Over)' : 'Menos de (Under)'} ${line}`;
                    }
                  } else if (sport === 'Vôlei') {
                    if (betType === 'vencedor') {
                      const winnerText = g.winner === 'home' ? roomData.home_team : roomData.away_team;
                      return `Vencedor: ${winnerText}`;
                    } else {
                      return `Placar de Sets: ${g.sets_score}`;
                    }
                  } else if (sport === 'Fórmula 1') {
                    if (betType === 'vencedor_corrida') {
                      return `Vencedor: ${g.winner}`;
                    } else {
                      const pod = g.podium || [];
                      return `Pódio: 1º ${pod[0] || '-'} | 2º ${pod[1] || '-'} | 3º ${pod[2] || '-'}`;
                    }
                  }
                  return '';
                };

                return (
                  <div key={guess.id} className="bg-surface-container p-5 rounded-xl flex flex-col gap-3 border border-outline-variant/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          guess.payment_status === 'confirmed' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {guess.payment_status === 'confirmed' ? 'Pago & Confirmado' : 'Aguardando Validação'}
                        </span>
                        <h4 className="font-display text-lg font-bold text-on-surface mt-2">
                          {roomData.title}
                        </h4>
                        <p className="text-xs text-on-surface/60 mt-0.5 font-medium">
                          {roomData.sport ? `[${roomData.sport}] ` : ''}
                          {renderGuessDescription()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-on-surface/40 uppercase tracking-wider">Valor do Pix</p>
                        <p className="font-display font-bold text-primary">
                          R$ {Number(guess.final_value).toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-[9px] text-on-surface/40 mt-0.5">
                          (cota R$ {Number(roomData.valor_da_cota).toFixed(2).replace('.', ',')})
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2 pt-3 border-t border-outline-variant/10 text-xs text-on-surface/50 flex-wrap justify-between items-center">
                      <span>Palpitado em: {new Date(guess.created_at).toLocaleDateString('pt-BR')}</span>
                      <Link
                        to={`/resenha/${guess.room_id}`}
                        className="text-primary font-bold hover:underline"
                      >
                        Ver Sala de Palpites →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Botão Flutuante (FAB) - Apenas na aba de organizador */}
      {activeTab === 'organizer' && (
        <Link
          to="/create-room"
          className="hidden lg:flex fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full items-center justify-center font-bold text-2xl shadow-neon active:scale-95 transition-transform hover:shadow-[0_0_20px_var(--fab-hover-shadow)]"
        >
          +
        </Link>
      )}

      {shareModalOpen && selectedRoomToShare && (
        <ShareResenhaModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedRoomToShare(null);
          }}
          room={selectedRoomToShare}
        />
      )}
    </div>
  );
}
