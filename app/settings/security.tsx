// F21 — Settings bảo mật: PIN + biometric.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { notify } from '../../src/utils/notify';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { useT } from '../../src/i18n/useT';
import {
  hasPin,
  setPin as savePin,
  clearPin,
  isBiometricEnabled,
  setBiometricEnabled,
  canUseBiometric,
} from '../../src/services/lock';

const PIN_LENGTH = 6;

export default function Security() {
  const t = useT();
  const router = useRouter();
  const palette = useTheme();

  const [pinSet, setPinSet] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [mode, setMode] = useState<'idle' | 'create-1' | 'create-2' | 'remove-confirm'>('idle');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setPinSet(await hasPin());
    setBioOn(await isBiometricEnabled());
    setBioAvailable(await canUseBiometric());
  }

  function startCreate() {
    setPin1('');
    setPin2('');
    setError('');
    setMode('create-1');
  }

  function pressDigit(d: string) {
    setError('');
    if (mode === 'create-1') {
      if (pin1.length >= PIN_LENGTH) return;
      const next = pin1 + d;
      setPin1(next);
      if (next.length >= 4) {
        // Cho phép confirm khi đủ 4 hoặc 6
      }
    } else if (mode === 'create-2') {
      if (pin2.length >= pin1.length) return;
      const next = pin2 + d;
      setPin2(next);
      if (next.length === pin1.length) {
        if (next !== pin1) {
          setError(t('security.pinMismatch2'));
          setPin1('');
          setPin2('');
          setMode('create-1');
        } else {
          confirmCreate(next);
        }
      }
    }
  }

  function backspace() {
    if (mode === 'create-1') setPin1(pin1.slice(0, -1));
    else if (mode === 'create-2') setPin2(pin2.slice(0, -1));
  }

  function nextStep() {
    if (mode === 'create-1') {
      if (pin1.length < 4) {
        setError(t('security.pinShort'));
        return;
      }
      setError('');
      setMode('create-2');
    }
  }

  async function confirmCreate(value: string) {
    try {
      await savePin(value);
      await refresh();
      setMode('idle');
      setPin1('');
      setPin2('');
      notify(t('security.set'));
    } catch (e: any) {
      setError(e?.message || 'Lỗi không xác định');
    }
  }

  async function doRemove() {
    const confirmed =
      Platform.OS === 'web'
        ? confirm(t('security.turnOffConfirmWeb'))
        : await new Promise<boolean>((resolve) => {
            Alert.alert(t('security.turnOffConfirmTitle'), t('security.turnOffConfirmMsg'), [
              { text: t('common.cancel'), onPress: () => resolve(false) },
              { text: t('security.turnOff').replace('Tắt PIN', 'Tắt'), style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    await clearPin();
    await refresh();
    notify(t('security.turnOffDone'));
  }

  async function toggleBio(value: boolean) {
    if (!pinSet) {
      notify(t('security.bioNeedPin'));
      return;
    }
    if (!bioAvailable && value) {
      notify(t('security.bioNotSupported'));
      return;
    }
    await setBiometricEnabled(value);
    setBioOn(value);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={24} color="#1f2937" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('security.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
              <Icon name="Lock" size={20} color={palette.primary} />
            </View>
            <Text style={styles.sectionTitle}>{t('security.pinSection')}</Text>
          </View>
          <Text style={styles.sectionDesc}>
            {t('security.pinSectionDesc')}
          </Text>

          {mode === 'idle' ? (
            pinSet ? (
              <View style={styles.rowBetween}>
                <Text style={styles.statusOn}>
                  <Text style={{ color: palette.primary }}>● </Text>{t('security.pinOn')}
                </Text>
                <TouchableOpacity style={styles.dangerLink} onPress={doRemove}>
                  <Text style={styles.dangerText}>{t('security.turnOff')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: palette.primary }]}
                onPress={startCreate}
              >
                <Text style={styles.btnText}>{t('security.setPin')}</Text>
              </TouchableOpacity>
            )
          ) : (
            <View>
              <Text style={styles.stepLabel}>
                {mode === 'create-1' ? t('security.enterPin', { len: '4-6' }) : t('security.confirmPin')}
              </Text>
              <View style={styles.dotsRow}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                  const cur = mode === 'create-1' ? pin1 : pin2;
                  const full = cur.length > i;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        full && { backgroundColor: palette.primary, borderColor: palette.primary },
                      ]}
                    />
                  );
                })}
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.pad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={styles.key}
                    onPress={() => pressDigit(String(d))}
                  >
                    <Text style={styles.keyText}>{d}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.key} onPress={() => setMode('idle')}>
                  <Text style={styles.keyCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.key} onPress={() => pressDigit('0')}>
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>
                {mode === 'create-1' && pin1.length >= 4 ? (
                  <TouchableOpacity style={[styles.key, { backgroundColor: palette.primary }]} onPress={nextStep}>
                    <Icon name="Check" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.key} onPress={backspace}>
                    <Icon name="X" size={24} color="#374151" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                <Icon name="Sparkles" size={20} color={palette.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>{t('security.biometric')}</Text>
                <Text style={[styles.sectionDesc, { marginBottom: 0 }]}>
                  {bioAvailable ? t('security.bioFaceFinger') : t('security.bioNotAvailable')}
                </Text>
              </View>
            </View>
            <Switch
              value={bioOn}
              onValueChange={toggleBio}
              disabled={!pinSet || !bioAvailable}
              trackColor={{ true: palette.primary, false: '#d1d5db' }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.note}>{t('security.forgotPin')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { padding: 20 },
  section: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 12, color: '#6b7280', lineHeight: 18, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statusOn: { fontSize: 13, fontWeight: '600', color: '#111827' },
  dangerLink: { padding: 6 },
  dangerText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  stepLabel: { fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  dotsRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 8,
  },
  key: {
    width: '30%',
    height: 56,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  keyText: { fontSize: 22, fontWeight: '600', color: '#111827' },
  keyCancelText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  note: { fontSize: 11, color: '#6b7280', lineHeight: 16, fontStyle: 'italic' },
});
