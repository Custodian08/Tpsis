import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: authService.getCurrentUser(),
  isAuthenticated: authService.isAuthenticated(),
  
  login: async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    set({ user: response.user, isAuthenticated: true });
  },
  
  register: async (email: string, password: string, fullName: string) => {
    const response = await authService.register({ email, password, fullName });
    set({ user: response.user, isAuthenticated: true });
  },
  
  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },
  
  loadUser: () => {
    const user = authService.getCurrentUser();
    set({ user, isAuthenticated: authService.isAuthenticated() });
  },
}));