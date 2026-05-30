import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';

export default function NavigationLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ name: string; tokens: number } | null>(null);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, tokens')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching layout profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching layout profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user, location.pathname]); // Re-fetch profile when route changes to keep tokens updated

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Painel',
      desktopLabel: 'Minhas Resenhas',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      to: '/create-room',
      label: 'Criar',
      desktopLabel: 'Nova Resenha',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      to: '/buy-tokens',
      label: 'Tokens',
      desktopLabel: 'Comprar Tokens',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      to: '/profile',
      label: 'Perfil',
      desktopLabel: 'Meu Perfil',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* 1. Sidebar para Desktop/Tablet */}
      <aside className="hidden md:flex flex-col justify-between fixed top-0 bottom-0 left-0 w-64 bg-surface-container-low border-r border-outline-variant/30 p-6 z-40">
        <div className="flex flex-col gap-8">
          {/* Brand/Logo */}
          <div className="flex items-center gap-3">
            <img src="https://resenhabet.app/assets/apple-touch-icon.png" alt="Resenha Bet Logo" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">Resenha Bet</h1>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 h-11 rounded-lg font-display text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-on-surface/60 hover:bg-surface-container hover:text-on-surface'
                  }`
                }
              >
                {item.icon}
                <span>{item.desktopLabel}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Profile Section & Theme Switch */}
        <div className="flex flex-col gap-5 pt-6 border-t border-outline-variant/25">
          {/* Profile Card */}
          <div className="flex items-center justify-between bg-surface-container p-3 rounded-xl border border-outline-variant/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-display font-bold text-xs text-primary shadow-sm flex-shrink-0">
                {(profile?.name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="font-display font-bold text-xs text-on-surface truncate">
                  {profile?.name || user?.email?.split('@')[0]}
                </h4>
                <p className="text-[10px] text-on-surface/60 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Tokens Balance and Toggle */}
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-on-surface/60">Saldo:</span>
            <span className="font-display font-bold text-primary text-sm">
              {profile?.tokens ?? 0} Tokens
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 active:scale-95 transition-all text-xs font-bold font-display cursor-pointer"
              title="Sair da Conta"
            >
              {navItems[3].to && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Bottom Nav para Mobile */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-low border-t border-outline-variant/30 px-3 items-center justify-around z-50 shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 flex-1 py-1 text-center font-display transition-all duration-200 ${
                isActive ? 'text-primary' : 'text-on-surface/55 hover:text-on-surface'
              }`
            }
          >
            <div className="transition-transform duration-200 active:scale-75">
              {item.icon}
            </div>
            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 3. Área de Conteúdo Principal */}
      <main className="md:pl-64 pb-20 md:pb-6 transition-all duration-200">
        <Outlet />
      </main>
    </div>
  );
}
