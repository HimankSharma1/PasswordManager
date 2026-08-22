import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { CustomAlert as Alert } from '../utils/alert';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/useAuthStore';
import { deriveKey } from '../services/cryptoService';
import { Buffer } from 'buffer';

interface Props {
  visible: boolean;
  title?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActionAuthModal({ visible, title = 'Authenticate', onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBiometricPromptActiveUI, setIsBiometricPromptActiveUI] = useState(false);
  const { mek } = useAuthStore();

  useEffect(() => {
    if (visible) {
      setPassword('');
      checkBiometrics();
    }
  }, [visible]);

  const checkBiometrics = async () => {
    const hasMek = await SecureStore.getItemAsync('has_biometric_mek');
    if (hasMek === 'true') {
      setIsBiometricPromptActiveUI(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: title,
          fallbackLabel: 'Use Master Password',
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
      <View className="flex-1 bg-black/80 justify-center p-6">
        <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700">
          {isBiometricPromptActiveUI ? (
            <View className="items-center justify-center py-6">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-zinc-400 mt-6 font-semibold">Waiting for Biometrics...</Text>
            </View>
          ) : (
            <>
              <Text className="text-xl font-bold text-white mb-2">{title}</Text>
              <Text className="text-zinc-400 mb-6">Enter your Master Password to proceed.</Text>
              
              <TextInput
                className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl mb-6"
                placeholder="Master Password"
                placeholderTextColor="#52525B"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                onSubmitEditing={handlePasswordSubmit}
                autoFocus
              />
              
              <View className="flex-row gap-4 space-x-4">
                <TouchableOpacity 
                  className="flex-1 bg-zinc-800 p-4 rounded-xl items-center"
                  onPress={onCancel}
                  disabled={isProcessing}
                >
                  <Text className="text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`flex-1 bg-blue-600 p-4 rounded-xl items-center justify-center flex-row ${(!password || isProcessing) ? 'opacity-50' : ''}`}
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
          )}
        </View>
      </View>
    </Modal>
  );
}
