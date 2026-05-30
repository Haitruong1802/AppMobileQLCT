// F21 — App lock: PIN + biometric (Face ID / Touch ID / Fingerprint).
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'bop_pin';
const PIN_LENGTH_KEY = 'bop_pin_length';
const BIOMETRIC_KEY = 'bop_biometric_enabled';

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN phải 4-6 chữ số');
  await SecureStore.setItemAsync(PIN_KEY, pin);
  await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(pin.length));
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(PIN_LENGTH_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

/** Trả độ dài PIN đã set (4-6), hoặc 6 nếu chưa biết. */
export async function getPinLength(): Promise<number> {
  const v = await SecureStore.getItemAsync(PIN_LENGTH_KEY);
  const n = parseInt(v || '', 10);
  if (n >= 4 && n <= 6) return n;
  // Fallback: kiểm tra length từ PIN gốc nếu pin_length key chưa được set (legacy)
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (stored && stored.length >= 4 && stored.length <= 6) return stored.length;
  return 6;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  return stored === pin;
}

export async function hasPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return !!stored;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? '1' : '0');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return v === '1';
}

export async function canUseBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric(reason = 'Mở khoá Bux2'): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Dùng PIN',
      cancelLabel: 'Huỷ',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
