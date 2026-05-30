// v3.120 — notify() route qua Toast (slide-in 2.5s), thay Alert.alert block.
// Web fallback dùng alert() native vì không có Toast component.
import { Platform } from 'react-native';
import { useToastStore, ToastVariant } from '../store/useToast';

export function notify(msg: string, variant: ToastVariant = 'info'): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    alert(msg);
    return;
  }
  useToastStore.getState().push(msg, variant);
}
