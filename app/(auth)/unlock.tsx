import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { useAuthStore } from '../../store/useAuthStore';
import { useVaultStore } from '../../store/useVaultStore';
import { deriveKey } from '../../services/cryptoService';
import { loadVault } from '../../services/storageService';
import { BiometricPrompt } from '../../components/BiometricPrompt';

let isBiometricPromptActive = false;

export default function UnlockScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [isBiometricPromptActiveUI, setIsBiometricPromptActiveUI] = useState(false);
  const [isInitializingBiometrics, setIsInitializingBiometrics] = useState(true);
  
  const { setMEK } = useAuthStore();
  const { setEntries, setFolders } = useVaultStore();

  useEffect(() => {
    isBiometricPromptActive = false;
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasMek = await SecureStore.getItemAsync('has_biometric_mek');
      if (hasMek === 'true') {
        setCanUseBiometrics(true);
        // Auto-prompt on mount
        handleBiometricUnlock();
      } else {
        setIsInitializingBiometrics(false);
      }
    } catch (e: any) {
      console.error('Biometric check failed:', e);
      setIsInitializingBiometrics(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (isBiometricPromptActive) return;
    isBiometricPromptActive = true;
    setIsBiometricPromptActiveUI(true);
    
    // Give UI time to render the loading state before the native prompt blocks the thread (especially on fresh app boot)
    await new Promise(resolve => setTimeout(resolve, 250));
    
    try {
      const mekBase64 = await SecureStore.getItemAsync('vault_mek', { requireAuthentication: true });
      if (mekBase64) {
        const mek = new Uint8Array(Buffer.from(mekBase64, 'base64'));
        await unlockWithKey(mek);
      }
    } catch (error) {
      // Biometric failed or intentionally cancelled by user
      // We fail silently here so they can seamlessly fallback to typing their Master Password
      setIsBiometricPromptActiveUI(false);
      setIsInitializingBiometrics(false);
    } finally {
      setTimeout(() => {
        isBiometricPromptActive = false;
        setIsBiometricPromptActiveUI(false);
        setIsInitializingBiometrics(false);
      }, 500);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password) return;
    setIsProcessing(true);
    
    try {
      const saltBase64 = await SecureStore.getItemAsync('vault_salt');
      if (!saltBase64) throw new Error('Salt not found. Vault is corrupted.');
      
      const salt = new Uint8Array(Buffer.from(saltBase64, 'base64'));
      const mek = await deriveKey(password, salt);
      await unlockWithKey(mek);
      
    } catch (error) {
      Alert.alert('Unlock Failed', 'Incorrect Master Password.');
      setPassword('');
    } finally {
      setIsProcessing(false);
    }
  };

  const unlockWithKey = async (key: Uint8Array) => {
    try {
      const vaultData = await loadVault(key);
      setEntries(vaultData.entries);
      if (vaultData.folders) setFolders(vaultData.folders);
      setMEK(key);
      router.replace('/(tabs)');
    } catch (error) {
      throw new Error('Failed to decrypt vault');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-blue-500 rounded-3xl items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
            <Text className="text-4xl text-white">🔒</Text>
          </View>
          <Text className="text-3xl font-bold text-white mb-2">Vault Locked</Text>
          <Text className="text-zinc-400 text-center">Enter your Master Password to decrypt your local vault.</Text>
        </View>
        
        {(isBiometricPromptActiveUI || isInitializingBiometrics) ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-zinc-400 mt-6 font-semibold">Waiting for Biometrics...</Text>
          </View>
        ) : (
          <>
            <View className="mb-6">
              <TextInput
                className="bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl text-lg text-center"
                placeholder="Master Password"
                placeholderTextColor="#52525B"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                onSubmitEditing={handlePasswordUnlock}
              />
            </View>

            <TouchableOpacity
              className={`bg-blue-500 p-4 rounded-xl items-center flex-row justify-center mb-6 ${isProcessing ? 'opacity-50' : ''}`}
              onPress={handlePasswordUnlock}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white font-bold text-lg">Unlock</Text>
              )}
            </TouchableOpacity>

            {canUseBiometrics && (
              <View className="mt-4">
                <BiometricPrompt onAuthenticate={handleBiometricUnlock} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
