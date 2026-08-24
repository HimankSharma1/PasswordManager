import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppState, AppStateStatus, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/useAuthStore';
import { GlobalAlert } from '../components/GlobalAlert';
import { useVaultStore } from '../store/useVaultStore';
import { vaultExists } from '../services/storageService';
import * as ScreenCapture from 'expo-screen-capture';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '../store/useThemeStore';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import '../global.css';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isUnlocked, lockVault } = useAuthStore();
  const { clearVault } = useVaultStore();
  const { theme, loadTheme } = useThemeStore();
  const { colorScheme, setColorScheme } = useColorScheme();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Prevent screen capture for security
    // ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    loadTheme();
  }, []);

  useEffect(() => {
    setColorScheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const { ignoreAppBackground } = useAuthStore.getState();
      if ((nextAppState === 'background' || nextAppState === 'inactive') && !ignoreAppBackground) {
        // Wipe in-memory vault and keys when transitioning to background
        lockVault();
        clearVault();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const hasVault = await vaultExists();
      const inAuthGroup = segments[0] === '(auth)';

      if (!hasVault) {
        if (segments.join('/') !== '(auth)/setup') {
          router.replace('/(auth)/setup');
        }
      } else if (!isUnlocked) {
        if (segments.join('/') !== '(auth)/unlock') {
          router.replace('/(auth)/unlock');
        }
      } else if (isUnlocked && inAuthGroup) {
        router.replace('/(tabs)');
      }
      setIsInitialized(true);
    };

    initializeAuth();
  }, [isUnlocked, segments]);

  if (!isInitialized) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-500">Loading Vault...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colorScheme === 'dark' ? '#09090b' : '#f4f4f5' } }} />
      <GlobalAlert />
    </ThemeProvider>
  );
}
