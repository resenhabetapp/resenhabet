import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { SportSelector } from '../components/SportSelector';

export default function CreateRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [minQuotaValue, setMinQuotaValue] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('email'); // email | cpf | phone | random
  const [deadline, setDeadline] = useState(''); // datetime-local
  const [regraEmpate, setRegraEmpate] = useState('acumular'); // acumular | banca
  const [regraBancaComissionada, setRegraBancaComissionada] = useState(false);
  const [comissaoPorcentagem, setComissaoPorcentagem] = useState(10); // default 10%
  const [fieldErrors, setFieldErrors] = useState<{
    homeTeam?: string;
    awayTeam?: string;
    minQuotaValue?: string;
    pixKey?: string;
    deadline?: string;
    gpName?: string;
    f1Competitors?: string;
    basketballLine?: string;
  }>({});
  const [sport, setSport] = useState('Futebol');
  const [betType, setBetType] = useState('placar_exato');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  
  // Custom states for tennis, basketball, and F1
  const [gpName, setGpName] = useState('');
  const [bestOfSets, setBestOfSets] = useState('3');
  const [basketballLine, setBasketballLine] = useState('210.5');
  const [f1Competitors, setF1Competitors] = useState<string[]>([]);
  const [newF1Competitor, setNewF1Competitor] = useState('');
  const [dbDrivers, setDbDrivers] = useState<{ name: string; code: string; team: string }[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch creator's name and default PIX key on mount
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('name, default_pix_key, default_pix_key_type')
          .eq('id', user.id)
          .single();
        if (data) {
          if (data.name) {
            setProfileName(data.name);
          } else {
            setProfileName(user.user_metadata?.name || user.email?.split('@')[0] || 'Organizador');
          }
          if (data.default_pix_key) {
            let keyType = data.default_pix_key_type || 'email';
            let keyVal = data.default_pix_key;
            if (keyType === 'cpf') {
              const digits = keyVal.replace(/\D/g, '').slice(0, 11);
              keyVal = digits.replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else if (keyType === 'phone') {
              const digits = keyVal.replace(/\D/g, '').slice(0, 11);
              keyVal = digits.replace(/^([0-9]{2})([0-9]{5})([0-9]{4}).*/, '($1) $2-$3');
            } else if (keyType === 'random') {
              const clean = keyVal.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
              const parts = [];
              if (clean.length > 0) parts.push(clean.slice(0, 8));
              if (clean.length > 8) parts.push(clean.slice(8, 12));
              if (clean.length > 12) parts.push(clean.slice(12, 16));
              if (clean.length > 16) parts.push(clean.slice(16, 20));
              if (clean.length > 20) parts.push(clean.slice(20, 32));
              keyVal = parts.join('-');
            }
            setPixKey(keyVal);
            setPixKeyType(keyType);
          }
        } else {
          setProfileName(user.user_metadata?.name || user.email?.split('@')[0] || 'Organizador');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setProfileName(user.user_metadata?.name || user.email?.split('@')[0] || 'Organizador');
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch F1 drivers from database when sport is Fórmula 1
  useEffect(() => {
    if (sport === 'Fórmula 1') {
      const fetchDrivers = async () => {
        setLoadingDrivers(true);
        try {
          const { data, error } = await supabase
            .from('f1_drivers')
            .select('name, code, team')
            .eq('active', true)
            .order('name');
          if (error) throw error;
          if (data) {
            setDbDrivers(data);
            // By default, select all drivers from the grid
            setF1Competitors(data.map(d => d.name));
          }
        } catch (err) {
          console.error('Error fetching F1 drivers:', err);
        } finally {
          setLoadingDrivers(false);
        }
      };
      fetchDrivers();
    }
  }, [sport]);

  // Auto‑generate title based on creator's name, sport, and selected teams/GP
  useEffect(() => {
    if (!profileName) {
      setTitle('');
      return;
    }
    if (sport === 'Fórmula 1') {
      setTitle(`Resenha "${profileName}" | ${gpName.trim() || 'GP de Fórmula 1'}`);
    } else if (homeTeam.trim() && awayTeam.trim()) {
      setTitle(`Resenha "${profileName}" | ${homeTeam.trim()} x ${awayTeam.trim()}`);
    } else {
      setTitle('');
    }
  }, [profileName, sport, gpName, homeTeam, awayTeam]);

  const handleSportChange = (selectedSport: string) => {
    setSport(selectedSport);
    // Reset values for new sport
    setHomeTeam('');
    setAwayTeam('');
    setGpName('');
    setF1Competitors([]);
    setNewF1Competitor('');

    if (selectedSport === 'Futebol') setBetType('placar_exato');
    else if (selectedSport === 'Tênis') setBetType('vencedor');
    else if (selectedSport === 'Basquete') setBetType('vencedor');
    else if (selectedSport === 'Vôlei') setBetType('vencedor');
    else if (selectedSport === 'Fórmula 1') setBetType('vencedor_corrida');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const errors: typeof fieldErrors = {};

    if (sport === 'Fórmula 1') {
      if (!gpName.trim()) errors.gpName = 'Nome do GP/Corrida é obrigatório.';
      if (f1Competitors.length < 3) errors.f1Competitors = 'Adicione pelo menos 3 competidores/pilotos.';
    } else {
      if (!homeTeam.trim()) errors.homeTeam = sport === 'Tênis' ? 'Jogador 1 é obrigatório.' : 'Time de casa é obrigatório.';
      if (!awayTeam.trim()) errors.awayTeam = sport === 'Tênis' ? 'Jogador 2 é obrigatório.' : 'Time de fora é obrigatório.';
      if (sport === 'Basquete' && betType === 'pontos_total') {
        const lineVal = parseFloat(basketballLine);
        if (!basketballLine.trim() || isNaN(lineVal) || lineVal <= 0) {
          errors.basketballLine = 'Informe uma linha de pontos válida maior que zero.';
        }
      }
    }

    if (!minQuotaValue) errors.minQuotaValue = 'Valor da aposta é obrigatório.';
    if (!deadline) errors.deadline = 'Horário limite é obrigatório.';
    
    if (!pixKey.trim()) {
      errors.pixKey = 'Chave Pix é obrigatória.';
    } else {
      if (pixKeyType === 'email') {
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailRegex.test(pixKey.trim())) {
          errors.pixKey = 'Informe um e-mail válido para a chave Pix.';
        }
      } else if (pixKeyType === 'cpf') {
        const digits = pixKey.replace(/\D/g, '');
        if (digits.length !== 11) {
          errors.pixKey = 'Informe um CPF válido (11 dígitos).';
        }
      } else if (pixKeyType === 'phone') {
        const digits = pixKey.replace(/\D/g, '');
        if (digits.length < 10) {
          errors.pixKey = 'Informe um telefone válido.';
        }
      } else if (pixKeyType === 'random') {
        const cleanKey = pixKey.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (cleanKey.length !== 32) {
          errors.pixKey = 'A chave aleatória deve ter exatamente 32 caracteres alfanuméricos.';
        }
      }
    }

    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (deadlineDate <= new Date()) {
        errors.deadline = 'O horário limite para palpites deve ser uma data/hora no futuro.';
      }
    }

    const quota = parseFloat(minQuotaValue.replace(/[^\d,]/g, '').replace(',', '.'));
    if (minQuotaValue && (isNaN(quota) || quota <= 0)) {
      errors.minQuotaValue = 'O valor da aposta deve ser válido e maior que zero.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    // Construct event_data and fallback home/away teams
    let eventData: any = null;
    let finalHomeTeam = '';
    let finalAwayTeam = '';

    if (sport === 'Fórmula 1') {
      eventData = { gp_name: gpName.trim(), competitors: f1Competitors };
      finalHomeTeam = gpName.trim();
      finalAwayTeam = 'Fórmula 1';
    } else {
      finalHomeTeam = homeTeam.trim();
      finalAwayTeam = awayTeam.trim();
      if (sport === 'Futebol') {
        eventData = { home_team: finalHomeTeam, away_team: finalAwayTeam };
      } else if (sport === 'Tênis') {
        eventData = { player_a: finalHomeTeam, player_b: finalAwayTeam, best_of: parseInt(bestOfSets) };
      } else if (sport === 'Basquete') {
        eventData = { home_team: finalHomeTeam, away_team: finalAwayTeam, line: parseFloat(basketballLine) };
      } else if (sport === 'Vôlei') {
        eventData = { home_team: finalHomeTeam, away_team: finalAwayTeam };
      }
    }

    try {
      const { error: insertError } = await supabase.from('rooms').insert({
        creator_id: user?.id,
        title: title,
        home_team: finalHomeTeam,
        away_team: finalAwayTeam,
        valor_da_cota: quota,
        horario_limite: deadline ? deadline : null,
        regra_empate: regraEmpate,
        regra_banca_comissionada: regraBancaComissionada,
        comissao_porcentagem: regraBancaComissionada ? comissaoPorcentagem : 0,
        pix_key: pixKeyType === 'random' ? pixKey.replace(/-/g, '').trim() : pixKey.trim(),
        pix_key_type: pixKeyType,
        sport: sport,
        bet_type: betType,
        event_data: eventData,
        status: 'active',
      });

      if (insertError) {
        if (insertError.message.includes('Saldo de tokens insuficiente')) {
          setError('Saldo de tokens insuficiente para criar uma nova resenha.');
        } else {
          setError(insertError.message);
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao tentar criar a resenha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-primary font-bold hover:underline">
          ← Voltar
        </Link>
        <h2 className="font-display text-2xl font-bold text-on-surface">Nova Resenha</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {/* Sport selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Esporte</label>
        <div className="flex justify-center py-2">
          <SportSelector
            selectedSport={sport}
            onSelect={(selected) => handleSportChange(selected.id)}
          />
        </div>
      </div>


      {/* Tipo de Aposta selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Tipo de Aposta</label>
        <select
          value={betType}
          onChange={(e) => setBetType(e.target.value)}
          disabled={loading}
          className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
        >
          {sport === 'Futebol' && (
            <>
              <option value="placar_exato">Placar Exato (Ex: 2x1)</option>
              <option value="resultado_final">Resultado Final (Casa / Empate / Fora)</option>
            </>
          )}
          {sport === 'Tênis' && (
            <>
              <option value="vencedor">Vencedor (Jogador 1 / Jogador 2)</option>
              <option value="placar_sets">Placar de Sets (Ex: 2x1)</option>
            </>
          )}
          {sport === 'Basquete' && (
            <>
              <option value="vencedor">Vencedor (Time 1 / Time 2)</option>
              <option value="pontos_total">Pontos Total Over/Under</option>
            </>
          )}
          {sport === 'Vôlei' && (
            <>
              <option value="vencedor">Vencedor (Time 1 / Time 2)</option>
              <option value="placar_sets">Placar de Sets (Ex: 3x1)</option>
            </>
          )}
          {sport === 'Fórmula 1' && (
            <>
              <option value="vencedor_corrida">Vencedor da Corrida</option>
              <option value="podio">Pódio (Top 3)</option>
            </>
          )}
        </select>
      </div>

      {/* Competitor Inputs depending on the sport */}
      {sport !== 'Fórmula 1' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">
              {sport === 'Tênis' ? 'Jogador 1' : 'Time de Casa'}
            </label>
            <input
              type="text"
              placeholder={sport === 'Tênis' ? 'Ex: Roger Federer' : 'Ex: Brasil'}
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
            />
            {fieldErrors.homeTeam && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.homeTeam}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">
              {sport === 'Tênis' ? 'Jogador 2' : 'Time de Fora'}
            </label>
            <input
              type="text"
              placeholder={sport === 'Tênis' ? 'Ex: Rafael Nadal' : 'Ex: Argentina'}
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
            />
            {fieldErrors.awayTeam && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.awayTeam}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Nome da Corrida / GP</label>
            <input
              type="text"
              placeholder="Ex: GP de Mônaco"
              value={gpName}
              onChange={(e) => setGpName(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
            />
            {fieldErrors.gpName && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.gpName}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">
                Pilotos do Grid ({f1Competitors.length})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setF1Competitors(dbDrivers.map(d => d.name))}
                  disabled={loading || loadingDrivers}
                  className="px-2 py-0.5 bg-surface-container-highest hover:bg-outline-variant/20 rounded text-[10px] font-bold text-on-surface border border-outline-variant/30"
                >
                  Selecionar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setF1Competitors([])}
                  disabled={loading || loadingDrivers}
                  className="px-2 py-0.5 bg-surface-container-highest hover:bg-outline-variant/20 rounded text-[10px] font-bold text-on-surface border border-outline-variant/30"
                >
                  Limpar
                </button>
              </div>
            </div>

            {loadingDrivers ? (
              <p className="text-xs text-on-surface/40 animate-pulse py-2">Carregando pilotos do grid...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-surface-container rounded-lg border border-outline-variant/10">
                {dbDrivers.map((driver) => {
                  const isSelected = f1Competitors.includes(driver.name);
                  return (
                    <label
                      key={driver.code}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-bold'
                          : 'bg-surface-container-low border-outline-variant/10 text-on-surface/70 hover:border-outline-variant/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setF1Competitors(f1Competitors.filter((name) => name !== driver.name));
                          } else {
                            setF1Competitors([...f1Competitors, driver.name]);
                          }
                        }}
                        className="hidden"
                      />
                      <span className="w-5 h-5 rounded bg-surface-container-highest flex items-center justify-center font-mono font-black text-[9px]">
                        {driver.code}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{driver.name}</span>
                        <span className="text-[9px] text-on-surface/40 font-normal truncate">{driver.team}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Custom driver text input */}
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[10px] font-bold text-on-surface/50 uppercase tracking-wider">
                Adicionar Piloto Fora do Grid / Reserva
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Oliver Bearman"
                  value={newF1Competitor}
                  onChange={(e) => setNewF1Competitor(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const name = newF1Competitor.trim();
                      if (name && !f1Competitors.includes(name)) {
                        setF1Competitors([...f1Competitors, name]);
                      }
                      setNewF1Competitor('');
                    }
                  }}
                  className="flex-1 h-11 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newF1Competitor.trim();
                    if (name && !f1Competitors.includes(name)) {
                      setF1Competitors([...f1Competitors, name]);
                    }
                    setNewF1Competitor('');
                  }}
                  disabled={loading}
                  className="h-11 px-4 bg-surface-container-highest hover:bg-outline-variant/20 rounded-lg text-on-surface font-bold text-xs transition-colors border border-outline-variant/30"
                >
                  + Add
                </button>
              </div>
              {fieldErrors.f1Competitors && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.f1Competitors}</p>
              )}
            </div>

            {/* Visual list of custom drivers added */}
            {f1Competitors.filter((name) => !dbDrivers.some((d) => d.name === name)).length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] font-bold text-on-surface/50 uppercase tracking-wider">
                  Pilotos Convidados Adicionados:
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {f1Competitors
                    .filter((name) => !dbDrivers.some((d) => d.name === name))
                    .map((driver, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-200"
                      >
                        {driver}
                        <button
                          type="button"
                          onClick={() => setF1Competitors(f1Competitors.filter((d) => d !== driver))}
                          className="text-primary hover:text-red-400 font-bold ml-1 text-sm focus:outline-none leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sport specific settings */}
      {sport === 'Tênis' && betType === 'placar_sets' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Melhor de quantos sets?</label>
          <select
            value={bestOfSets}
            onChange={(e) => setBestOfSets(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="3">Melhor de 3 (vence quem fizer 2 sets)</option>
            <option value="5">Melhor de 5 (vence quem fizer 3 sets)</option>
          </select>
        </div>
      )}

      {sport === 'Basquete' && betType === 'pontos_total' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Linha de Pontos Over/Under</label>
          <input
            type="text"
            placeholder="Ex: 210.5"
            value={basketballLine}
            onChange={(e) => setBasketballLine(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.basketballLine && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.basketballLine}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Título da Resenha</label>
          <input
            type="text"
            value={title}
            readOnly
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
        </div>
        {/* Valor da Aposta with currency mask */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Valor da Aposta</label>
          <input
            type="text"
            placeholder="R$ 0,00"
            value={minQuotaValue}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              const number = digits ? (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
              setMinQuotaValue(number ? `R$ ${number}` : '');
            }}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.minQuotaValue && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.minQuotaValue}</p>
          )}
        </div>

        {/* Tipo de chave Pix */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Tipo de Chave Pix</label>
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="email">E‑mail</option>
            <option value="cpf">CPF</option>
            <option value="phone">Telefone</option>
            <option value="random">Chave aleatória</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Data e Horário Limite</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.deadline && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.deadline}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Regra para Empate</label>
          <select
            value={regraEmpate}
            onChange={(e) => setRegraEmpate(e.target.value)}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          >
            <option value="acumular">Acumular (pot)</option>
            <option value="banca">Banca (vai para a casa)</option>
          </select>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-on-surface">Banca Comissionada</span>
              <span className="text-[11px] text-on-surface/50">Cobrar comissão do pote acumulado</span>
            </div>
            
            <button
              type="button"
              onClick={() => setRegraBancaComissionada(!regraBancaComissionada)}
              disabled={loading}
              className={`w-14 h-8 border rounded-full relative p-1 flex items-center cursor-pointer select-none outline-none focus:outline-none transition-all ${
                regraBancaComissionada 
                  ? 'bg-primary/20 border-primary' 
                  : 'bg-surface-container-highest border-outline-variant'
              }`}
              aria-label="Toggle Banca Comissionada"
            >
              {/* Sliding Knob */}
              <div
                className={`w-6 h-6 rounded-full bg-primary shadow transform transition-transform duration-300 ease-in-out ${
                  regraBancaComissionada ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          {regraBancaComissionada && (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Porcentagem da Comissão</label>
              <select
                value={comissaoPorcentagem}
                onChange={(e) => setComissaoPorcentagem(Number(e.target.value))}
                disabled={loading}
                className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                  <option key={val} value={val}>
                    {val}%
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sua Chave Pix para Recebimento with dynamic mask/validation */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-on-surface/60 uppercase tracking-wider">Sua Chave Pix para Recebimento</label>
          <input
            type="text"
            placeholder={pixKeyType === 'email' ? 'exemplo@dominio.com' : pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'phone' ? '(00) 00000-0000' : '00000000-0000-0000-0000-000000000000'}
            value={pixKey}
            onChange={(e) => {
              let val = e.target.value;
              if (pixKeyType === 'cpf') {
                const digits = val.replace(/\D/g, '').slice(0, 11);
                val = digits.replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
              } else if (pixKeyType === 'phone') {
                const digits = val.replace(/\D/g, '').slice(0, 11);
                const d = digits.replace(/^([0-9]{2})([0-9]{5})([0-9]{4}).*/, '($1) $2-$3');
                val = d;
              } else if (pixKeyType === 'random') {
                const clean = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
                const parts = [];
                if (clean.length > 0) parts.push(clean.slice(0, 8));
                if (clean.length > 8) parts.push(clean.slice(8, 12));
                if (clean.length > 12) parts.push(clean.slice(12, 16));
                if (clean.length > 16) parts.push(clean.slice(16, 20));
                if (clean.length > 20) parts.push(clean.slice(20, 32));
                val = parts.join('-');
              }
              setPixKey(val);
            }}
            disabled={loading}
            className="h-12 px-4 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary focus:border-2 disabled:opacity-50"
          />
          {fieldErrors.pixKey && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.pixKey}</p>
          )}
        </div>

        <div className="mt-auto pt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-on-primary font-display font-bold rounded-lg shadow-neon active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Criando Resenha...
              </>
            ) : (
              'Criar Sala e Gerar Link'
            )}
          </button>
        </div>
      </form>
    </div>
  );

}
