// v3.131 — Modal Upgrade Pro: gọi từ feature card khi free user tap tính năng cao cấp.
// Chuyên nghiệp hơn router.push('/premium') trực tiếp (giữ user trong context, đỡ giật).
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { t } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Feature key để chọn title/desc/benefits phù hợp. */
  feature: 'autoSavings' | 'theme' | 'backup' | 'unlimited' | 'generic';
}

interface FeatureContent {
  icon: string;
  title: string;
  desc: string;
  benefits: string[];
}

const CONTENT: Record<Props['feature'], FeatureContent> = {
  autoSavings: {
    icon: 'Sparkles',
    title: 'Tự động tiết kiệm',
    desc: 'Mỗi ngày app tự chích một khoản nhỏ vào mục tiêu để bạn tiết kiệm mà không cần nghĩ.',
    benefits: [
      'Chích N% số dư mỗi ngày, làm tròn đẹp',
      'Gợi ý cộng dư cuối ngày 1 chạm',
      'Nhắc nhở tối 22h để không quên',
    ],
  },
  theme: {
    icon: 'Palette',
    title: 'Theme màu cao cấp',
    desc: 'Đổi tông màu app theo gu của bạn, gồm "Đỏ Sài Gòn" branded.',
    benefits: [
      '6 bộ màu cao cấp (Mint, Đỏ, Grape, Sunset, Ocean, Mono)',
      'Đổi tức thì, không cần khởi động lại',
      'Đồng bộ với biểu đồ và badge',
    ],
  },
  backup: {
    icon: 'Cloud',
    title: 'Sao lưu & Khôi phục',
    desc: 'Xuất toàn bộ dữ liệu thành file mã hoá, khôi phục bất kỳ lúc nào.',
    benefits: [
      'Sao lưu encrypted AES-256, file .bux2bak',
      'Khôi phục về bất cứ thiết bị nào',
      'An tâm khi đổi máy hay reset',
    ],
  },
  unlimited: {
    icon: 'Crown',
    title: 'Mở khoá không giới hạn',
    desc: 'Bỏ giới hạn số lượng để quản lý tài chính linh hoạt hơn.',
    benefits: [
      'Sổ kế toán không giới hạn',
      'Ví, mục tiêu, hoá đơn, giao dịch lặp không giới hạn',
      'Multi-book cho cá nhân + gia đình + dự án',
    ],
  },
  generic: {
    icon: 'Crown',
    title: 'Tính năng nâng cao',
    desc: 'Tính năng này dành cho gói Pro để đảm bảo hiệu năng và trải nghiệm tốt nhất.',
    benefits: [
      'Mở khoá toàn bộ tính năng cao cấp',
      'Sao lưu encrypted + báo cáo PDF',
      'Theme cao cấp + tự động tiết kiệm',
    ],
  },
};

export function ProUpgradeModal({ visible, onClose, feature }: Props) {
  const router = useRouter();
  const c = CONTENT[feature];

  function handleUpgrade() {
    onClose();
    // Delay nhỏ để modal có thời gian animate close trước khi navigate
    setTimeout(() => router.push('/premium'), 120);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Crown header */}
          <View style={styles.headerRow}>
            <View style={styles.crownBox}>
              <Icon name={c.icon} size={28} color="#fbbf24" strokeWidth={2.5} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="X" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.desc}>{c.desc}</Text>

          <View style={styles.benefitsList}>
            {c.benefits.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.checkBox}>
                  <Icon name="Check" size={12} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Icon name="Crown" size={18} color="#1f2937" strokeWidth={2.5} />
            <Text style={styles.upgradeBtnText}>Nâng cấp Pro</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.laterText}>{t('common.later')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  crownBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 19, fontWeight: '800', color: '#111827', marginBottom: 6 },
  desc: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 16 },
  benefitsList: { gap: 10, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  upgradeBtnText: { color: '#1f2937', fontSize: 15, fontWeight: '800' },
  laterBtn: { paddingVertical: 10, alignItems: 'center' },
  laterText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
});
