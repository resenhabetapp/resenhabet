import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus?: string;
  color: string;
  popular?: boolean;
}

export default function BuyTokens() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPkg, setSelectedPkg] = useState<TokenPackage | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packages: TokenPackage[] = [
    {
      id: 'bronze',
      name: 'Bronze',
      tokens: 5,
      price: 5.00,
      color: 'from-amber-700 to-amber-900',
    },
    {
      id: 'silver',
      name: 'Prata',
      tokens: 12,
      price: 10.00,
      bonus: '2 tokens grátis',
      color: 'from-slate-400 to-slate-600',
      popular: true,
    },
    {
      id: 'gold',
      name: 'Ouro',
      tokens: 30,
      price: 20.00,
      bonus: '10 tokens grátis',
      color: 'from-yellow-500 to-amber-500',
    },
    {
      id: 'diamond',
      name: 'Diamante',
      tokens: 100,
      price: 50.00,
      bonus: '50 tokens grátis',
      color: 'from-cyan-400 to-blue-600',
    },
  ];

  const handleOpenPix = (pkg: TokenPackage) => {
    setSelectedPkg(pkg);
    setPixModalOpen(true);
    setSuccess(false);
    setError(null);
  };

  const handleSimulatePayment = async () => {
    if (!user || !selectedPkg) return;
    setSimulating(true);
    setError(null);

    // Simulated network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // Insert completed purchase transaction in database
      const { error: txError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          amount: selectedPkg.tokens,
          type: 'purchase',
          status: 'completed',
          price: selectedPkg.price,
        });

      if (txError) {
        setError(txError.message);
      } else {
        setSuccess(true);
        // Autoclose after 1.5s and redirect
        setTimeout(() => {
          setPixModalOpen(false);
          setSelectedPkg(null);
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao simular pagamento.');
    } finally {
      setSimulating(false);
    }
  };

  const mockPixKey = '00020101021226830014br.gov.bcb.pix2561pix-qr.resenhabet.app/qrc/token-purchase-key-hash-55823152540500';

  return (
    <div className="px-4 py-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-bold text-on-surface">Comprar Tokens</h2>
        <p className="text-sm text-on-surface/60 mt-1">
          Adicione créditos para criar novas resenhas na plataforma. Cada resenha criada custa 1 Token.
        </p>
      </div>

      {/* Grid de Pacotes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`bg-surface-container p-5 rounded-xl border relative flex flex-col justify-between transition-all duration-300 ${
              pkg.popular
                ? 'border-primary shadow-neon ring-1 ring-primary/20 scale-[1.02] sm:scale-100 lg:scale-[1.02]'
                : 'border-outline-variant/10 hover:border-outline-variant/40'
            }`}
          >
            {pkg.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                Popular
              </span>
            )}

            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-display font-bold text-sm text-on-surface/75 uppercase tracking-wide">
                    Plano {pkg.name}
                  </h4>
                  <p className="font-display font-black text-3xl text-on-surface mt-1.5">
                    {pkg.tokens} <span className="text-xs text-on-surface/60 font-semibold">Tokens</span>
                  </p>
                </div>
              </div>

              {pkg.bonus && (
                <div className="mb-4 bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold py-1 px-2.5 rounded-lg text-center font-display uppercase tracking-wider">
                  🎉 {pkg.bonus}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <div className="text-center">
                <span className="text-xs text-on-surface/50">Valor total:</span>
                <p className="font-display font-extrabold text-xl text-primary mt-0.5">
                  R$ {pkg.price.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <button
                onClick={() => handleOpenPix(pkg)}
                className="w-full h-11 bg-primary text-on-primary font-display font-bold text-xs rounded-lg active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Comprar com Pix
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Pix Simulado */}
      {pixModalOpen && selectedPkg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 max-w-sm w-full flex flex-col gap-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Fechar */}
            <button
              onClick={() => !simulating && !success && setPixModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface/60 hover:text-on-surface transition-colors cursor-pointer"
              disabled={simulating || success}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Pagamento Pix</span>
              <h3 className="font-display text-xl font-bold text-on-surface mt-1">
                Adquirir {selectedPkg.tokens} Tokens
              </h3>
              <p className="text-xs text-on-surface/60 mt-1">
                Total: R$ {selectedPkg.price.toFixed(2).replace('.', ',')}
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-2xl animate-bounce">
                  ✓
                </div>
                <h4 className="font-display font-bold text-on-surface">Pagamento Confirmado!</h4>
                <p className="text-xs text-on-surface/60 text-center">
                  Seus créditos foram creditados no saldo da conta.
                </p>
              </div>
            ) : (
              <>
                {/* QR Code Mockup */}
                <div className="bg-white p-4 rounded-xl border border-outline-variant/10 flex items-center justify-center mx-auto shadow-inner relative group">
                  <svg className="w-36 h-36 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                    {/* Mock QR lines */}
                    <rect x="10" y="10" width="20" height="20" />
                    <rect x="15" y="15" width="10" height="10" fill="white" />
                    <rect x="70" y="10" width="20" height="20" />
                    <rect x="75" y="15" width="10" height="10" fill="white" />
                    <rect x="10" y="70" width="20" height="20" />
                    <rect x="15" y="75" width="10" height="10" fill="white" />
                    {/* Random blocks */}
                    <rect x="40" y="10" width="10" height="15" />
                    <rect x="55" y="10" width="10" height="5" />
                    <rect x="40" y="30" width="5" height="10" />
                    <rect x="50" y="35" width="15" height="10" />
                    <rect x="70" y="40" width="20" height="10" />
                    <rect x="10" y="45" width="15" height="5" />
                    <rect x="30" y="50" width="10" height="15" />
                    <rect x="45" y="55" width="20" height="20" />
                    <rect x="75" y="65" width="15" height="15" />
                    <rect x="10" y="60" width="5" height="5" />
                    <rect x="70" y="85" width="15" height="5" />
                    <rect x="35" y="80" width="5" height="10" />
                  </svg>
                  <div className="absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <span className="text-[10px] text-slate-900 font-bold tracking-tight">PIX COPIA E COLA ABAIXO</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-on-surface/60 uppercase tracking-wider">Chave Pix Copia e Cola</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={mockPixKey}
                      className="h-9 px-3 rounded-lg bg-surface border border-outline-variant/20 text-on-surface/60 text-xs min-w-0 flex-1 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(mockPixKey);
                        alert('Código Pix Copia e Cola copiado!');
                      }}
                      className="px-3 bg-surface-container-highest hover:bg-primary/10 text-on-surface text-xs font-bold rounded-lg border border-outline-variant/30 transition-all cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-lg text-xs font-medium text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSimulatePayment}
                  disabled={simulating}
                  className="w-full h-11 bg-primary text-on-primary font-display font-bold text-xs rounded-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  {simulating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      Processando Simulação...
                    </>
                  ) : (
                    'Confirmar Pagamento Simulado'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
