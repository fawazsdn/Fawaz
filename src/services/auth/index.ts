import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export const DEMO_OTP_CODE = '123456';

export interface AuthService {
  sendOtp(phone: string): Promise<{ ok: true }>;
  verifyOtp(code: string): Promise<{ ok: boolean }>;
}

/**
 * Frontend-only mock authentication. This is NOT production auth — it
 * exists so the rest of the app can be exercised end to end. Real phone
 * verification (SMS OTP) belongs to a future backend.
 */
export const authService: AuthService = {
  async sendOtp(phone) {
    useStore.getState().setPhone(phone);
    return mockDelay({ ok: true }, 600);
  },
  async verifyOtp(code) {
    const ok = code === DEMO_OTP_CODE;
    if (ok) useStore.getState().verifyOtp();
    return mockDelay({ ok }, 500);
  },
};
