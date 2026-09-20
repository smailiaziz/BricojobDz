import { useState, useEffect, useCallback } from 'react';
import { UserSession } from '../types';
import { authService } from '../services';

export function useAuthSession() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    return authService.getCurrentUser();
  });

  // Sync Current User with Local Storage via AuthService
  useEffect(() => {
    if (currentUser) {
      authService.saveCurrentUserSession(currentUser);
    } else {
      authService.logout();
    }
  }, [currentUser]);

  const login = useCallback((user: UserSession) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
  }, []);

  return {
    currentUser,
    setCurrentUser,
    login,
    logout,
  };
}
