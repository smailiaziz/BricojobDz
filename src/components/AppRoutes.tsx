import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Artisan, ServiceCategory, UserSession } from '../types';
import { SERVICE_CATEGORIES } from '../data';
import { HomeScreen } from './HomeScreen';
import { SearchScreen } from './SearchScreen';
import { FavoritesScreen } from './FavoritesScreen';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { ArtisanWorkspaceScreen } from './ArtisanWorkspaceScreen';
import { AccountScreen } from './AccountScreen';
import { OrdersScreen } from './OrdersScreen';

interface AppRoutesProps {
  categories: ServiceCategory[];
  artisans: Artisan[];
  favorites: string[];
  favoriteArtisans: Artisan[];
  currentUser: UserSession | null;
  onToggleFavorite: (artisanId: string) => void;
  onSelectArtisan: (artisan: Artisan) => void;
  onBackToHome: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onLoginSuccess: (user: UserSession) => void;
  onRegisterSuccess: (user: UserSession, newArtisan?: Artisan) => void;
  onLogout: () => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onNavigateToSearch: () => void;
  onSaveArtisanProfile: (newArtisan: Artisan) => void;
  onUpdateArtisanProfile: (updatedArtisan: Artisan) => void;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  categories,
  artisans,
  favorites,
  favoriteArtisans,
  currentUser,
  onToggleFavorite,
  onSelectArtisan,
  onBackToHome,
  onOpenLogin,
  onOpenRegister,
  onLoginSuccess,
  onRegisterSuccess,
  onLogout,
  onShowToast,
  onNavigateToSearch,
  onSaveArtisanProfile,
  onUpdateArtisanProfile,
}) => {
  const location = useLocation();

  return (
    <Routes>
      <Route 
        path="/artisan" 
        element={
          currentUser ? (
            currentUser.role === 'artisan' ? (
              <ArtisanWorkspaceScreen
                currentUser={currentUser}
                artisans={artisans}
                onLogout={onLogout}
                onShowToast={onShowToast}
                onSaveArtisanProfile={onSaveArtisanProfile}
                onUpdateArtisanProfile={onUpdateArtisanProfile}
                onPreviewPublicProfile={onSelectArtisan}
                onGoToSearch={onNavigateToSearch}
              />
            ) : (
              <Navigate to="/search" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      <Route 
        path="/login" 
        element={
          <LoginScreen
            currentUser={currentUser}
            onBack={onBackToHome}
            onNavigateToRegister={onOpenRegister}
            onLoginSuccess={onLoginSuccess}
            onShowToast={onShowToast}
          />
        } 
      />
      
      <Route 
        path="/register" 
        element={
          <RegisterScreen
            currentUser={currentUser}
            categories={SERVICE_CATEGORIES}
            onBack={onBackToHome}
            onNavigateToLogin={onOpenLogin}
            onRegisterSuccess={onRegisterSuccess}
            onShowToast={onShowToast}
          />
        } 
      />

      <Route 
        path="/account" 
        element={
          currentUser && currentUser.role === 'user' ? (
            <AccountScreen
              currentUser={currentUser}
              onLogout={onLogout}
            />
          ) : (
            <Navigate to={currentUser?.role === 'artisan' ? '/artisan' : '/login'} replace />
          )
        } 
      />

      <Route 
        path="/search" 
        element={
          <SearchScreen
            categories={categories}
            artisans={artisans}
            favoriteIds={favorites}
            currentUser={currentUser}
            onToggleFavorite={onToggleFavorite}
            onBack={onBackToHome}
            onSelectArtisan={onSelectArtisan}
          />
        } 
      />

      <Route 
        path="/favorites" 
        element={
          <FavoritesScreen
            favoriteArtisans={favoriteArtisans}
            onToggleFavorite={onToggleFavorite}
            onSelectArtisan={onSelectArtisan}
            onGoSearch={onNavigateToSearch}
          />
        } 
      />

      <Route 
        path="/orders" 
        element={
          currentUser ? (
            <OrdersScreen
              currentUser={currentUser}
              artisans={artisans}
              onShowToast={onShowToast}
              onSelectArtisan={onSelectArtisan}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      <Route 
        path="/" 
        element={
          <main className="flex-1 w-full flex flex-col">
            <HomeScreen
              categories={categories}
              artisans={artisans}
              favoriteIds={favorites}
              currentUser={currentUser}
              onToggleFavorite={onToggleFavorite}
              onSelectArtisan={onSelectArtisan}
              onOpenLogin={onOpenLogin}
              onOpenRegister={onOpenRegister}
              onLogout={onLogout}
              onSearchClick={onNavigateToSearch}
            />
          </main>
        } 
      />

      <Route 
        path="/artisan/:id" 
        element={
          location.state?.background === '/' ? (
            <HomeScreen
              categories={categories}
              artisans={artisans}
              favoriteIds={favorites}
              currentUser={currentUser}
              onToggleFavorite={onToggleFavorite}
              onSelectArtisan={onSelectArtisan}
              onOpenLogin={onOpenLogin}
              onOpenRegister={onOpenRegister}
              onLogout={onLogout}
              onSearchClick={onNavigateToSearch}
            />
          ) : location.state?.background === '/favorites' ? (
            <FavoritesScreen
              favoriteArtisans={favoriteArtisans}
              onToggleFavorite={onToggleFavorite}
              onSelectArtisan={onSelectArtisan}
              onGoSearch={onNavigateToSearch}
            />
          ) : (
            <SearchScreen
              categories={categories}
              artisans={artisans}
              favoriteIds={favorites}
              currentUser={currentUser}
              onToggleFavorite={onToggleFavorite}
              onBack={onBackToHome}
              onSelectArtisan={onSelectArtisan}
            />
          )
        } 
      />
    </Routes>
  );
};
