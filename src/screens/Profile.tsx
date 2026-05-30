import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

interface Transaction {
  id: string;
  amount: number;
  type: 'purchase' | 'room_creation' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  price: number;
  created_at: string;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [tokens, setTokens] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchProfileAndTx = async () => {
      try {
        // Fetch Profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name, tokens')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error(profileError);
        } else if (profile) {
          setName(profile.name);
          setTokens(profile.tokens);
        }
        setLoadingProfile(false);

        // Fetch Transactions
        const { data: txs, error: txError } = await supabase
          .from('token_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (txError) {
          console.error(txError);
        } else {
          setTransactions(txs || []);
        }
        setLoadingTx(false);
      } catch (err) {
        console.error(err);
      }
    };

    fetchProfileAndTx();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('O nome não pode ficar em branco.');
      setUpdating(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess('Nome atualizado com sucesso!');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao atualizar.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const typeMap = {
    purchase: { label: 'Compra de Tokens', color: 'text-green-500' },
    room_creation: { label: 'Criação de Resenha', color: 'text-red-500' },
    refund: { label: 'Reembolso', color: 'text-blue-500' },
  };

  const statusMap = {
    completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
    pending: { label: 'Pendente', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };

  return (
    <div className="px-4 py-6 flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-bold text-on-surface">Meu Perfil</h2>
        <p className="text-sm text-on-surface/60 mt-1">
          Gerencie seus dados pessoais, configurações de tema e acompanhe o extrato de tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lado Esquerdo: Info de Perfil */}
        <div className="md:col-span-2 flex flex-col gap-5">
          {/* Card de Configurações */}
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/10">
            <h3 className="font-display text-lg font-bold text-on-surface mb-4">Dados da Conta</h3>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-medium mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-primary/10 border border-primary/30 text-primary p-3 rounded-lg text-xs font-medium mb-4">
                {success}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">E-mail (Login)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={user?.email || ''}
                  className="h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant/15 text-on-surface/50 text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Nome de Exibição</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loadingProfile || updating}
                  placeholder="Seu nome"
                  className="h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loadingProfile || updating}
                className="h-11 bg-primary text-on-primary font-display font-bold text-xs rounded-lg active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                {updating ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>

        {/* Lado Direito: Aparência e logout (Super prático no celular) */}
        <div className="flex flex-col gap-5">
          {/* Card de Configurações Rápidas */}
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/10 flex flex-col gap-4">
            <h3 className="font-display text-lg font-bold text-on-surface">Configurações</h3>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Tema do App</span>
              <div className="flex items-center justify-between bg-surface-container-low p-2 rounded-lg border border-outline-variant/10">
                <span className="text-xs font-bold text-on-surface/75">Tema</span>
                <ThemeToggle />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-on-surface/60 uppercase tracking-wider">Saldo Atual</span>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/10 text-center">
                <span className="font-display font-black text-xl text-primary">{tokens} Tokens</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full h-10 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-display font-bold text-xs rounded-lg border border-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair da Conta
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de Transações */}
      <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/10">
        <h3 className="font-display text-lg font-bold text-on-surface mb-4">Extrato de Tokens</h3>

        {loadingTx ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-6 text-xs text-on-surface/50">
            Você ainda não possui transações registradas.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {transactions.map((tx) => {
              const displayType = typeMap[tx.type] || { label: tx.type, color: '' };
              const displayStatus = statusMap[tx.status] || { label: tx.status, color: '' };
              const sign = tx.amount > 0 ? '+' : '';
              
              return (
                <div
                  key={tx.id}
                  className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/5 flex justify-between items-center text-xs"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-on-surface truncate">
                      {displayType.label}
                    </span>
                    <span className="text-[10px] text-on-surface/40">
                      {new Date(tx.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-display font-black text-sm ${tx.amount > 0 ? 'text-primary' : 'text-red-400'}`}>
                        {sign}{tx.amount} Tokens
                      </p>
                      {tx.price > 0 && (
                        <p className="text-[10px] text-on-surface/50">
                          R$ {tx.price.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${displayStatus.color}`}>
                      {displayStatus.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
