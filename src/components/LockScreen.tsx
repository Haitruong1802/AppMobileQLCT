// F21 — Lock screen overlay. Hiện khi `useAuth.locked === true`.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useAuth } from '../store/useAuth';
import { useTheme } from '../store/useTheme';
import { isBiometricEnabled, canUseBiometric, getPinLength } from '../services/lock';

const MAX_PIN_LENGTH = 6;

export function LockScreen() {
  const palette = useTheme();
  const locked = useAuth((s) => s.locked);
  const failedAttempts = useAuth((s) => s.failedAttempts);
  const lockedUntilMs = useAuth((s) => s.lockedUntilMs);
  const tryUnlockWithPin = useAuth((s) => s.tryUnlockWithPin);
  const tryUnlockWithBiometric = useAuth((s) => s.tryUnlockWithBiometric);

  const [pin, setPin] = useState('');
  const [pinLength, setPinLength] = useState(6);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    if (!locked) return;
    let on = true;
    (async () => {
      const len = await getPinLength();
      if (on) setPinLength(len);
      const enabled = await isBiometricEnabled();
      const can = await canUseBiometric();
      if (on) setBioAvailable(enabled && can);
      if (enabled && can) {
        const ok = await tryUnlockWithBiometric();
        if (ok && on) setPin('');
      }
    })();
    return () => {
      on = false;
    };
  }, [locked]);

  useEffect(() => {
    if (!lockedUntilMs) {
      setLockoutCountdown(0);
      return;
    }
    const tick = () => {
      const remain = Math.max(0, lockedUntilMs - Date.now());
      setLockoutCountdown(Math.ceil(remain / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntilMs]);

  if (!locked) return null;

  function press(digit: string) {
    if (lockoutCountdown > 0) return;
    if (pin.length >= MAX_PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    // Auto verify khi đủ length đúng PIN đã set
    if (next.length === pinLength) {
      tryUnlock(next);
    }
  }

  function backspace() {
    setPin(pin.slice(0, -1));
  }

  async function tryUnlock(value: string) {
    const ok = await tryUnlockWithPin(value);
    if (!ok) {
      setPin('');
    }
  }

  async function bioBtn() {
    await tryUnlockWithBiometric();
  }

  const inLockout = lockoutCountdown > 0;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={[styles.lockIconBox, { backgroundColor: palette.primaryLight }]}>
            <Icon name="Lock" size={40} color={palette.primary} />
          </View>
          <Text style={styles.title}>Mở khoá Bux2</Text>
          <Text style={styles.subtitle}>
            {inLockout
              ? `Khoá ${lockoutCountdown}s do nhập sai 5 lần`
              : 'Nhập mã PIN'}
          </Text>

          {/* PIN dots — đúng độ dài PIN đã set */}
          <View style={styles.dotsRow}>
            {Array.from({ length: pinLength }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  pin.length > i && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              />
            ))}
          </View>

          {failedAttempts > 0 && !inLockout ? (
            <Text style={styles.warn}>Sai PIN. Còn {5 - failedAttempts} lần thử</Text>
          ) : null}

          {/* Number pad */}
          <View style={styles.pad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.key, inLockout && { opacity: 0.4 }]}
                onPress={() => press(String(d))}
                disabled={inLockout}
              >
                <Text style={styles.keyText}>{d}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.key, !bioAvailable && { opacity: 0 }]}
              onPress={bioBtn}
              disabled={!bioAvailable || inLockout}
            >
              {bioAvailable ? (
                <Icon name="Sparkles" size={28} color={palette.primary} />
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, inLockout && { opacity: 0.4 }]}
              onPress={() => press('0')}
              disabled={inLockout}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, (pin.length === 0 || inLockout) && { opacity: 0.4 }]}
              onPress={backspace}
              disabled={pin.length === 0 || inLockout}
            >
              <Icon name="X" size={26} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 9999,
    elevation: 9999,
  },
  safe: { flex: 1, backgroundColor: '#fff' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  lockIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 28 },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  warn: { fontSize: 12, color: '#ef4444', marginBottom: 12, fontWeight: '600' },
  pad: {
    width: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 12,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 2,
        }
      : { elevation: 1 }),
  },
  keyText: { fontSize: 26, fontWeight: '600', color: '#111827' },
});
