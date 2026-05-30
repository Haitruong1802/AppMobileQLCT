import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { useTheme } from '../../src/store/useTheme';
import { t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/useLocale';

export default function TabLayout() {
  const palette = useTheme();
  const insets = useSafeAreaInsets();
  useLocale(); // Re-render khi đổi ngôn ngữ
  // iOS có home indicator → insets.bottom > 0 đủ. Android nav buttons → insets.bottom = 0, cần extra padding.
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopColor: '#f3f4f6',
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.input'),
          tabBarIcon: ({ color, size }) => <Icon name="Pencil" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tab.calendar'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="CalendarDays" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t('tab.report'),
          tabBarIcon: ({ color, size }) => <Icon name="PieChart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: t('tab.budget'),
          tabBarIcon: ({ color, size }) => <Icon name="Wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tab.more'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="MoreHorizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
