import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

interface Room {
  id: string;
  title: string;
  home_team: string;
  away_team: string;
  valor_da_cota: number;
  horario_limite: string | null;
  sport?: string;
  bet_type?: string;
  event_data?: any;
}

interface ShareResenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
}

export default function ShareResenhaModal({ isOpen, onClose, room }: ShareResenhaModalProps) {
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const resenhaLink = `${window.location.origin}/resenha/${room.id}`;

  useEffect(() => {
    if (!isOpen || !room.id) return;

    const generateQr = async () => {
      setGeneratingQr(true);
      try {
        const qrDataUrl = await QRCode.toDataURL(resenhaLink, {
          width: 300,
          margin: 2,
          color: {
            dark: '#161e1a',
            light: '#ffffff'
          }
        });
        const base64Image = qrDataUrl.split(',')[1];
        setQrCodeBase64(base64Image);
      } catch (err) {
        console.error('Erro ao gerar QR Code para resenha:', err);
      } finally {
        setGeneratingQr(false);
      }
    };

    generateQr();
  }, [isOpen, room.id, resenhaLink]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(resenhaLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar link:', err);
      alert('Não foi possível copiar o link.');
    }
  };

  const getCardElement = () => document.getElementById('share-card-resenha');

  const handleDownload = async () => {
    const card = getCardElement();
    if (!card) return;

    try {
      const canvas = await html2canvas(card, {
        useCORS: true,
        backgroundColor: '#0c110e',
        scale: 2,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `resenha_${room.title.replace(/\s+/g, '_') || 'convite'}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();
    } catch (err) {
      console.error('Erro ao gerar imagem para download:', err);
      alert('Não foi possível gerar a imagem para download.');
    }
  };

  const handleWhatsAppShare = async () => {
    const card = getCardElement();
    if (!card) return;

    setSharing(true);
    const whatsappMessage = `Palpite na minha resenha! Acesse o link: ${resenhaLink}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    try {
      const canvas = await html2canvas(card, {
        useCORS: true,
        backgroundColor: '#0c110e',
        scale: 2,
      });

      // Tenta compartilhar como arquivo usando a Web Share API (para mobile)
      if (navigator.share && navigator.canShare) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], `resenha_${room.id}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Convite da Resenha: ${room.title}`,
              text: whatsappMessage,
            });
            setSharing(false);
            return;
          }
        }
      }

      // Se falhar (desktop ou sem suporte a arquivos na API Share):
      // Copia link
      await navigator.clipboard.writeText(resenhaLink);

      // Baixa a imagem
      const dataUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `resenha_${room.title.replace(/\s+/g, '_') || 'convite'}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();

      // Abre WhatsApp
      window.open(whatsappUrl, '_blank');
      alert('Imagem baixada e link copiado! Cole o link (Ctrl+V) e envie o QR Code no WhatsApp.');
    } catch (err) {
      console.error('Erro no compartilhamento inteligente:', err);
      window.open(whatsappUrl, '_blank');
    } finally {
      setSharing(false);
    }
  };

  const sport = room.sport || 'Futebol';
  const isF1 = sport === 'Fórmula 1';
  const betType = room.bet_type || 'placar_exato';

  const renderTitle = () => {
    if (isF1) {
      return room.event_data?.gp_name || room.home_team;
    }
    return `${room.home_team} × ${room.away_team}`;
  };

  const getSportIcon = () => {
    switch (sport) {
      case 'Futebol': return '⚽';
      case 'Fórmula 1': return '🏎️';
      case 'Tênis': return '🎾';
      case 'Basquete': return '🏀';
      default: return '🏆';
    }
  };

  const renderBetTypeLabel = () => {
    if (isF1) {
      return betType === 'vencedor_corrida' ? 'Vencedor da Corrida' : 'Pódio da Corrida';
    }
    return betType === 'placar_exato' ? 'Placar Exato' : 'Resultado do Jogo (1X2)';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-surface-container-low p-4 sm:p-6 rounded-2xl border border-outline-variant/20 max-w-sm w-full flex flex-col gap-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface/60 hover:text-on-surface transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="font-display text-lg font-bold text-on-surface">Compartilhar Convite</h3>
          <p className="text-xs text-on-surface/50 mt-1">Gere o QR Code ou compartilhe a imagem da sala</p>
        </div>

        {/* Card para Capturar (html2canvas) */}
        <div 
          id="share-card-resenha" 
          className="w-full max-w-[320px] mx-auto bg-[#0c110e] p-5 sm:p-6 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center gap-5 shadow-lg text-center select-none"
          style={{ boxSizing: 'border-box' }}
        >
          {/* Header do Card */}
          <div className="flex items-center justify-center gap-2 w-full text-center">
            <img 
              src="/logo.png" 
              alt="Resenha Bet Logo" 
              className="w-6 h-6 rounded-lg object-cover"
            />
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Resenha Bet</span>
          </div>

          <div className="w-full flex flex-col items-center justify-center gap-2">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              {getSportIcon()} {sport} · {renderBetTypeLabel()}
            </span>
            <h4 className="font-display text-base font-extrabold text-white mt-1 px-1 leading-snug text-center w-full">
              {renderTitle()}
            </h4>
            <p className="text-[10px] text-white/40 uppercase tracking-wide text-center w-full">Organizador: {room.title}</p>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-3.5 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-slate-200 w-36 h-36">
            {generatingQr ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : qrCodeBase64 ? (
              <img 
                src={`data:image/png;base64,${qrCodeBase64}`} 
                alt="QR Code Convite" 
                className="w-full h-full rounded-lg"
              />
            ) : (
              <div className="text-xs text-red-500 py-12">Erro ao carregar</div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5 w-full">
            <span className="text-[9px] text-white/50 uppercase tracking-wider text-center w-full">Escaneie para palpitar</span>
            <div className="inline-flex items-center justify-center gap-1.5 w-full">
              <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Cota: </span>
              <span className="text-sm font-bold text-emerald-400">R$ {Number(room.valor_da_cota).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold text-center w-full">resenhabet.app</span>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={handleWhatsAppShare}
            disabled={sharing}
            className="w-full h-11 bg-[#25D366] hover:bg-[#20ba5a] text-white font-display font-bold text-xs rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {sharing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.742.002-2.597-1.002-5.04-2.834-6.874-1.83-1.835-4.275-2.846-6.88-2.847-5.445 0-9.87 4.37-9.873 9.744-.001 1.956.516 3.868 1.5 5.586l-.985 3.596 3.698-.973zm10.704-5.328c-.294-.148-1.743-.86-2.012-.958-.267-.099-.463-.148-.659.148-.196.297-.759.958-.93.1.15-.196.297-.393.443-.659.297-.49.099-.759-.148-.958-.223-.198-.445-.494-.644-.94-.196-.445-.297-.86-.396-1.058-.099-.197-.197-.297-.297-.297-.1 0-.197-.1-.297-.1-.1 0-.297-.049-.463-.223-.166-.174-.627-.613-.627-1.496s.642-1.734.74-1.861c.099-.128 1.248-1.913 3.022-3.47 1.206-1.06 2.164-1.399 2.94-1.313.882.099 2.72.613 3.104 1.719.383 1.105.383 2.052.27 2.249-.115.197-.27.297-.565.446z"/>
                </svg>
                Compartilhar no WhatsApp
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              className="h-10 bg-surface-container-highest hover:bg-outline-variant/20 text-on-surface font-display font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-outline-variant/30 active:scale-95 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Baixar Imagem
            </button>

            <button
              onClick={handleCopyLink}
              className="h-10 bg-surface-container-highest hover:bg-outline-variant/20 text-on-surface font-display font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-outline-variant/30 active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copiar Link
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
