import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRooms = async () => {
      try {
        // Get user rooms
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });

        if (roomsError) {
          console.error('Error fetching rooms:', roomsError);
        } else {
          setRooms(roomsData || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [user]);

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      {/* Conteúdo */}
      <div className="flex-1 flex flex-col gap-4">
        <h3 className="font-display text-xl font-bold text-on-surface">Resenhas Ativas</h3>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_10px_var(--loader-shadow)]" />
          </div>
        ) : rooms.length === 0 ? (
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
                    <p className="text-xs text-on-surface/60 mt-0.5">{room.home_team} × {room.away_team}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-on-surface/40 uppercase tracking-wider">Cota</p>
                    <p className="font-display font-bold text-primary">R$ {Number(room.min_quota_value).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-2 pt-3 border-t border-outline-variant/10">
                  <Link
                    to={`/resenha/${room.id}/report`}
                    className="flex-1 h-9 bg-surface-container-highest hover:bg-outline-variant/20 rounded-lg flex items-center justify-center text-xs font-bold text-on-surface transition-colors"
                  >
                    Relatório &amp; Rateio
                  </Link>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/resenha/${room.id}`;
                      navigator.clipboard.writeText(link);
                      alert('Link de palpites copiado para o WhatsApp!');
                    }}
                    className="px-3 h-9 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                    title="Copiar Link de Convite"
                  >
                    Compartilhar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botão Flutuante (FAB) */}
      <Link
        to="/create-room"
        className="hidden lg:flex fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full items-center justify-center font-bold text-2xl shadow-neon active:scale-95 transition-transform hover:shadow-[0_0_20px_var(--fab-hover-shadow)]"
      >
        +
      </Link>
    </div>
  );
}
