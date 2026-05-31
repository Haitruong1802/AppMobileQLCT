// Catch render errors anywhere in component tree. F17 BUILD_SPEC.md.
import { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Lỗi không rõ' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Icon name="AlertCircle" size={56} color="#ef4444" />
          <Text style={styles.title}>{t('errBoundary.title')}</Text>
          <Text style={styles.message}>{this.state.message}</Text>
          <Text style={styles.hint}>{t('errBoundary.hint')}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 16 },
  message: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
    fontFamily: 'monospace',
  },
  hint: { fontSize: 13, color: '#6b7280', marginTop: 12, textAlign: 'center' },
  btn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
