import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
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
  const [showPassword, setShowPassword] = useState(false);
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
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vault',
        fallbackLabel: 'Use Master Password',
        disableDeviceFallback: true,
      });
      
      if (authResult.success) {
        let mekBase64: string | null = null;
        try {
          mekBase64 = await Promise.race([
            SecureStore.getItemAsync('vault_mek'),
            new Promise<string | null>((_, reject) => 
              setTimeout(() => reject(new Error('SecureStore timeout (invalidated keys)')), 1500)
            )
          ]);
        } catch (e) {
          // Android Keystore bug: key was invalidated, so it hung or threw.
          // Wipe the biometric flags and force password fallback.
          await SecureStore.deleteItemAsync('has_biometric_mek').catch(() => {});
          Alert.alert('Biometrics Invalidated', 'Your biometric keys were invalidated because your fingerprints changed. Please log in with your Master Password and re-enable biometrics in Settings.');
        }

        if (mekBase64) {
          const mek = new Uint8Array(Buffer.from(mekBase64, 'base64'));
          await unlockWithKey(mek);
        } else {
          setIsBiometricPromptActiveUI(false);
          setIsInitializingBiometrics(false);
        }
      } else {
        // Fallback to password
        setIsBiometricPromptActiveUI(false);
        setIsInitializingBiometrics(false);
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
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 50));

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
        
            <View className="mb-6 relative justify-center">
              <TextInput
                className="bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl text-lg text-center pr-12"
                placeholder="Master Password"
                placeholderTextColor="#52525B"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                onSubmitEditing={handlePasswordUnlock}
              />
              <TouchableOpacity 
                className="absolute right-4"
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff color="#9CA3AF" size={24} /> : <Eye color="#9CA3AF" size={24} />}
              </TouchableOpacity>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
