import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Artisan, UserSession } from './types';
import { authService } from './services/authService';
import { DesktopRestrictionScreen } from './components/DesktopRestrictionScreen';
import { BottomNav, NavView } from './components/BottomNav';
import { ArtisanDetailModal } from './components/ArtisanDetailModal';
import { ToastNotification } from './components/ToastNotification';
import { AppRoutes } from './components/AppRoutes';
import { 
  useToast, 
  useDesktopRestriction, 
  useAuthSession, 
  useArtisans, 
  useFavorites,
  usePwaInstallPrompt
} from './hooks';
import { PWAInstallBanner } from './components/PWAInstallBanner';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Toast Notification State & Handlers
  const { toast, showToast, closeToast } = useToast();

  // 2. Auth Session State & Handlers
  const { currentUser, setCurrentUser, login, logout } = useAuthSession();

  // 3. Artisans & Categories State & Actions
  const { 
    artisans, 
    computedCategories, 
    addArtisan,
    updateArtisan, 
    addReview, 
    updateReview, 
    deleteReview 
  } = useArtisans({ 
    currentUser, 
    onToast: showToast 
  });

  // 4. Favorites State & Actions
  const { 
    favorites, 
    favoriteArtisans, 
    toggleFavorite 
  } = useFavorites({ 
    artisans, 
    currentUser,
    onToast: showToast 
  });

  // 5. Desktop Restriction State & Actions
  const { 
    isDesktopBlocked, 
    bypassedDesktopRestriction, 
    bypassDesktop 
  } = useDesktopRestriction();

  // 6. PWA Install Experience State
  const pwaState = usePwaInstallPrompt();

  // 6. Navigation & View Routing State
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);

  const currentView: NavView = useMemo(() => {
    const path = location.pathname;
    const background = location.state?.background;
    const activePath = background || path;
    
    if (activePath === '/artisan') return 'artisan';
    if (activePath.startsWith('/artisan/')) return 'search';
    if (activePath === '/orders') return 'orders';
    if (activePath === '/search') return 'search';
    if (activePath === '/favorites') return 'favorites';
    if (activePath === '/login') return 'login';
    if (activePath === '/register') return 'register';
    if (activePath === '/account') return 'account';
    return 'home';
  }, [location.pathname, location.state?.background]);

  // Sync selectedArtisan with route param /artisan/:id
  useEffect(() => {
    const match = location.pathname.match(/\/artisan\/([^/]+)/);
    if (match) {
      const artisanId = match[1];
      const artisan = artisans.find(a => a.id === artisanId);
      if (artisan) {
        setSelectedArtisan(artisan);
      } else {
        setSelectedArtisan(null);
        navigate('/', { replace: true });
      }
    } else {
      setSelectedArtisan(null);
    }
  }, [location.pathname, artisans, navigate]);

  // 7. High-Level Navigation & Auth Event Handlers
  const handleNavigate = (view: NavView) => {
    if (view === 'home') navigate('/');
    else navigate(`/${view}`);
  };

  const handleOpenLogin = () => {
    navigate('/login');
  };

  const handleOpenRegister = () => {
    navigate('/register');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleLoginSuccess = (user: UserSession) => {
    login(user);
    if (user.role === 'artisan') {
      navigate('/orders', { replace: true });
    } else {
      navigate('/orders', { replace: true });
    }
  };

  const handleRegisterSuccess = (newUser: UserSession, newArtisan?: Artisan) => {
    login(newUser);
    if (newArtisan) {
      addArtisan(newArtisan);
    }
    if (newUser.role === 'artisan') {
      navigate('/orders', { replace: true });
    } else {
      navigate('/orders', { replace: true });
    }
  };

  const handleSelectArtisan = (artisan: Artisan) => {
    navigate(`/artisan/${artisan.id}`, { 
      state: { 
        background: location.pathname,
        searchState: location.state?.searchState,
      } 
    });
  };

  const handleCloseArtisanModal = () => {
    const background = location.state?.background;
    if (background) {
      navigate(-1);
    } else {
      if (currentView === 'home') navigate('/', { replace: true });
      else navigate(`/${currentView}`, { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    showToast('تم تسجيل الخروج بنجاح. نتمنى رؤيتك مجدداً!', 'info');
  };

  const handleSaveArtisanProfile = (newArtisan: Artisan) => {
    addArtisan(newArtisan);
    if (currentUser) {
      const updatedUser: UserSession = {
        ...currentUser,
        artisanId: newArtisan.id,
        wilaya: newArtisan.wilaya,
        city: newArtisan.city,
        phone: newArtisan.phone,
        profession: newArtisan.profession,
      };
      authService.updateUserSession(updatedUser);
      setCurrentUser(updatedUser);
    }
    showToast('تم إكمال وتفعيل ملفك المهني بنجاح! يمكنك الآن الظهور في دليل الحرفيين.', 'success');
  };

  const handleUpdateArtisanProfile = (updatedArtisan: Artisan) => {
    updateArtisan(updatedArtisan);
    if (currentUser) {
      const updatedUser: UserSession = {
        ...currentUser,
        wilaya: updatedArtisan.wilaya,
        city: updatedArtisan.city,
        phone: updatedArtisan.phone,
        profession: updatedArtisan.profession,
      };
      authService.updateUserSession(updatedUser);
      setCurrentUser(updatedUser);
    }
    showToast('تم تحديث ملفك المهني بنجاح!', 'success');
  };

  if (isDesktopBlocked && !bypassedDesktopRestriction) {
    return (
      <DesktopRestrictionScreen 
        onBypass={bypassDesktop}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-stone-200/60 flex justify-center font-['Cairo',sans-serif] antialiased selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden" dir="rtl">
      
      {/* Mobile Shell Container */}
      <div className={`w-full max-w-md min-h-[100dvh] ${['/', '/orders', '/search', '/favorites', '/login', '/register', '/account'].includes(location.pathname) ? 'bg-[#FAF8F5]' : 'bg-stone-50'} text-stone-900 flex flex-col shadow-sm relative pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]`}>

        {/* Floating Bottom Toast Notification */}
        <ToastNotification 
          toast={toast} 
          onClose={closeToast} 
        />

        {/* PWA Install Experience Banner & iOS Guide */}
        <PWAInstallBanner pwaState={pwaState} />

        {/* Application Routes */}
        <AppRoutes
          categories={computedCategories}
          artisans={artisans}
          favorites={favorites}
          favoriteArtisans={favoriteArtisans}
          currentUser={currentUser}
          onToggleFavorite={toggleFavorite}
          onSelectArtisan={handleSelectArtisan}
          onBackToHome={handleBackToHome}
          onOpenLogin={handleOpenLogin}
          onOpenRegister={handleOpenRegister}
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onLogout={handleLogout}
          onShowToast={showToast}
          onNavigateToSearch={() => navigate('/search')}
          onSaveArtisanProfile={handleSaveArtisanProfile}
          onUpdateArtisanProfile={handleUpdateArtisanProfile}
        />

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          currentView={currentView as any}
          currentUser={currentUser}
          favoritesCount={favoriteArtisans.length}
          onNavigate={handleNavigate}
        />

        {/* Unified Modals (Stay visible even on artisan route) */}
        {selectedArtisan && (
          <ArtisanDetailModal
            artisan={selectedArtisan}
            isFavorite={favorites.includes(selectedArtisan.id)}
            currentUser={currentUser}
            onToggleFavorite={toggleFavorite}
            onClose={handleCloseArtisanModal}
            onAddReview={addReview}
            onUpdateReview={updateReview}
            onDeleteReview={deleteReview}
            onOpenLogin={handleOpenLogin}
            onShowToast={showToast}
          />
        )}

      </div>
    </div>
  );
}


