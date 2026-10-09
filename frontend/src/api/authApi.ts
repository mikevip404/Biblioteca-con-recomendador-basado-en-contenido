import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse
} from '@/types/auth';

import { http, resetSessionRefreshGuard } from './http';

export const authApi = {
  async register(input: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await http.post<RegisterResponse>('/auth/register', input);
    return data;
  },

  async login(input: LoginRequest): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', input);
    resetSessionRefreshGuard();
    return data;
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout');
  },

  async logoutAll(): Promise<void> {
    await http.post('/auth/logout-all');
  },

  async fetchMe(): Promise<MeResponse> {
    const { data } = await http.get<MeResponse>('/auth/me');
    return data;
  }
};