import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [selectedPkg, setSelectedPkg] = useState<TokenPackage | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [creatingPix, setCreatingPix] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asaas PIX details
  const [paymentId, setPaymentId] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');

  const pollingIntervalRef = useRef<number | null>(null);

  const packages: TokenPackage[] = [
    {
      id: 'pkg_10',
      name: '10 Tokens',
      tokens: 10,
      price: 10.00,
      color: 'from-emerald-500 to-emerald-700',
    },
    {
      id: 'pkg_25',
      name: '25 Tokens',
      tokens: 25,
      price: 22.00,
      color: 'from-indigo-500 to-indigo-700',
    },
    {
      id: 'pkg_50',
      name: '50 Tokens',
      tokens: 50,
      price: 40.00,
      color: 'from-rose-500 to-rose-700',
    },
  ];

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const startPolling = (payId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('token_transactions')
          .select('status')
          .eq('external_id', payId)
          .maybeSingle();

        if (queryError) {
          console.error('Erro ao consultar transação:', queryError);
        }

        if (data && data.status === 'completed') {
          setSuccess(true);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Redirect to dashboard after success message displays
          setTimeout(() => {
            setPixModalOpen(false);
            setSelectedPkg(null);
            navigate('/dashboard');
          }, 2000);
        }
      } catch (err) {
        console.error('Erro ao consultar status da transação:', err);
      }
    }, 3000) as unknown as number;
  };

  const handleOpenPix = async (pkg: TokenPackage) => {
    setSelectedPkg(pkg);
    setPixModalOpen(true);
    setSuccess(false);
    setError(null);
    setCreatingPix(true);
    setPixCode('');
    setQrCodeBase64('');
    setPaymentId('');

    try {
      // Chama a Supabase Edge Function para gerar a cobrança Asaas Pix
      const { data, error: funcErr } = await supabase.functions.invoke('create-pix', {
        body: { packageId: pkg.id }
      });

      if (funcErr || !data || !data.success) {
        setError(funcErr?.message || data?.error || 'Erro ao gerar o Pix. Tente novamente mais tarde.');
      } else {
        setPaymentId(data.paymentId);
        setPixCode(data.payload);
        setQrCodeBase64(data.encodedImage);
        startPolling(data.paymentId);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro de conexão ao gerar o Pix.';
      setError(errMsg);
    } finally {
      setCreatingPix(false);
    }
  };

  const handleCloseModal = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPixModalOpen(false);
    setSelectedPkg(null);
    setSuccess(false);
    setError(null);
  };

  const handleCheckPaymentStatus = async () => {
    if (!paymentId) return;
    setSimulating(true);
    try {
      const { data } = await supabase
        .from('token_transactions')
        .select('status')
        .eq('external_id', paymentId)
        .maybeSingle();

      if (data && data.status === 'completed') {
        setSuccess(true);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setTimeout(() => {
          setPixModalOpen(false);
          setSelectedPkg(null);
          navigate('/dashboard');
        }, 2000);
      } else {
        alert('Pagamento ainda não confirmado. Se você já pagou, aguarde a compensação da rede Pix.');
      }
    } catch (err) {
      console.error('Erro na checagem manual:', err);
    } finally {
      setSimulating(false);
    }
  };

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

      {/* Modal Pix Real */}
      {pixModalOpen && selectedPkg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 max-w-sm w-full flex flex-col gap-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Fechar */}
            <button
              onClick={() => !creatingPix && !simulating && !success && handleCloseModal()}
              className="absolute top-4 right-4 text-on-surface/60 hover:text-on-surface transition-colors cursor-pointer"
              disabled={creatingPix || simulating || success}
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

            {creatingPix ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_10px_var(--loader-shadow)]" />
                <p className="text-xs text-on-surface/60">Gerando cobrança Pix no Asaas...</p>
              </div>
            ) : success ? (
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
                {qrCodeBase64 ? (
                  <div className="bg-white p-4 rounded-xl border border-outline-variant/10 flex items-center justify-center mx-auto shadow-inner relative group">
                    <img 
                      src={`data:image/png;base64,${qrCodeBase64}`} 
                      alt="QR Code Pix Asaas" 
                      className="w-36 h-36 rounded-lg shadow-sm border border-slate-100" 
                    />
                    <div className="absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-none">
                      <span className="text-[10px] text-slate-900 font-bold tracking-tight">PIX COPIA E COLA ABAIXO</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-red-400">
                    Não foi possível carregar o QR Code.
                  </div>
                )}

                {pixCode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-on-surface/60 uppercase tracking-wider">Chave Pix Copia e Cola</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={pixCode}
                        className="h-9 px-3 rounded-lg bg-surface border border-outline-variant/20 text-on-surface/60 text-xs min-w-0 flex-1 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pixCode);
                          alert('Código Pix Copia e Cola copiado!');
                        }}
                        className="px-3 bg-surface-container-highest hover:bg-primary/10 text-on-surface text-xs font-bold rounded-lg border border-outline-variant/30 transition-all cursor-pointer"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-lg text-xs font-medium text-center">
                    {error}
                  </div>
                )}

                <div className="text-center text-[10px] text-on-surface/50 mt-1 animate-pulse">
                  Aguardando pagamento do Pix...
                </div>

                {paymentId && (
                  <button
                    onClick={handleCheckPaymentStatus}
                    disabled={simulating}
                    className="w-full h-11 bg-primary text-on-primary font-display font-bold text-xs rounded-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {simulating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        Verificando Pagamento...
                      </>
                    ) : (
                      'Já Paguei (Verificar Status)'
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
