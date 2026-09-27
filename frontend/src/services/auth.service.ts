import api from './api';
import { LoginDto, RegisterDto, AuthResponse } from '../types';

export const authService = {
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', loginDto);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', registerDto);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('user');
    }
  },

  getCurrentUser() {
    // Remove tokens stored by older versions; credentials now stay in an HttpOnly cookie.
    localStorage.removeItem('token');
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },
};
