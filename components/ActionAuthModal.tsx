import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { CustomAlert as Alert } from '../utils/alert';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/useAuthStore';
import { deriveKey } from '../services/cryptoService';
import { Buffer } from 'buffer';
import { Eye, EyeOff } from 'lucide-react-native';

interface Props {
  visible: boolean;
  title?: string;
  forcePassword?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActionAuthModal({ visible, title = 'Authenticate', forcePassword = false, onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBiometricPromptActiveUI, setIsBiometricPromptActiveUI] = useState(false);
  const { mek } = useAuthStore();

  useEffect(() => {
    if (visible) {
      setPassword('');
      setIsBiometricPromptActiveUI(false);
      setIsProcessing(false);
      checkBiometrics();
    }
  }, [visible]);

  const checkBiometrics = async () => {
    if (forcePassword) return;
    
    const hasMek = await SecureStore.getItemAsync('has_biometric_mek');
    if (hasMek === 'true') {
      setIsBiometricPromptActiveUI(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: title,
          fallbackLabel: 'Use Master Password',
          disableDeviceFallback: true,
        });
        if (result.success) {
          onSuccess();
        } else {
          setIsBiometricPromptActiveUI(false);
        }
      } catch (e) {
        setIsBiometricPromptActiveUI(false);
        // Fallback to password input
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setIsProcessing(true);
    try {
      const saltBase64 = await SecureStore.getItemAsync('vault_salt');
      if (!saltBase64) throw new Error('Salt not found.');
      
      const salt = new Uint8Array(Buffer.from(saltBase64, 'base64'));
      const testMek = await deriveKey(password, salt);
      
      if (!mek) throw new Error('Vault is locked.');
      
      // Compare testMek and mek byte by byte
      let isMatch = true;
      if (testMek.length !== mek.length) isMatch = false;
      for (let i = 0; i < testMek.length; i++) {
        if (testMek[i] !== mek[i]) isMatch = false;
      }
      
      if (isMatch) {
        onSuccess();
      } else {
        Alert.alert('Authentication Failed', 'Incorrect Master Password.');
        setPassword('');
      }
    } catch (error) {
      Alert.alert('Error', 'Authentication error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView 
        behavior="padding" 
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-center p-6">
          <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <>
              <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{title}</Text>
              <Text className="text-zinc-600 dark:text-zinc-400 mb-6">Enter your Master Password to proceed.</Text>
              
              <View className="mb-6 relative justify-center">
                <TextInput
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl pr-12"
                  placeholder="Master Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  onSubmitEditing={handlePasswordSubmit}
                  autoFocus
                />
                <TouchableOpacity 
                  className="absolute right-4"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff color="#9CA3AF" size={24} /> : <Eye color="#9CA3AF" size={24} />}
                </TouchableOpacity>
              </View>
              
              <View className="flex-row gap-4">
                <TouchableOpacity 
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center"
                  onPress={onCancel}
                  disabled={isProcessing}
                >
                  <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`flex-1 bg-brand p-4 rounded-xl items-center justify-center flex-row ${(!password || isProcessing) ? 'opacity-50' : ''}`}
                  onPress={handlePasswordSubmit}
                  disabled={!password || isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
