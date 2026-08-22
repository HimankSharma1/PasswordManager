import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { useAuthStore } from '../../store/useAuthStore';
import { useVaultStore } from '../../store/useVaultStore';
import { deriveKey, generateSalt } from '../../services/cryptoService';
import { saveVault } from '../../services/storageService';
import { PasswordStrength } from '../../components/PasswordStrength';

export default function SetupScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { setMEK, setBiometricEnabled } = useAuthStore();
  const { setEntries } = useVaultStore();

  const handleSetup = async () => {
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Master Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Generate unique salt & derive MEK
      const salt = generateSalt();
      const mek = await deriveKey(password, salt);
      
      // 2. Store salt in SecureStore (no auth required for salt, just safe keeping)
      const saltBase64 = Buffer.from(salt).toString('base64');
      await SecureStore.setItemAsync('vault_salt', saltBase64);
      
      // 3. Store MEK in SecureStore if biometrics enabled
      if (useBiometrics) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        if (hasHardware && isEnrolled) {
          const mekBase64 = Buffer.from(mek).toString('base64');
          await SecureStore.setItemAsync('vault_mek', mekBase64, {
            requireAuthentication: true,
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          });
          await SecureStore.setItemAsync('has_biometric_mek', 'true');
          setBiometricEnabled(true);
        } else {
          Alert.alert('Biometrics Unavailable', 'Device does not support or have biometrics configured.');
          setBiometricEnabled(false);
        }
      } else {
        await SecureStore.deleteItemAsync('vault_mek');
        await SecureStore.deleteItemAsync('has_biometric_mek');
        setBiometricEnabled(false);
      }

      // 4. Initialize empty vault
      await saveVault({ version: 1, timestamp: Date.now(), entries: [] }, mek);
      
      // 5. Populate stores & redirect
      setEntries([]);
      setMEK(mek);
      router.replace('/(tabs)');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to setup vault. Please try again.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
        <Text className="text-3xl font-bold text-white mb-2">Welcome</Text>
        <Text className="text-zinc-400 mb-8">Create your zero-knowledge master password. If you lose this, your data is gone forever.</Text>
        
        <View className="mb-4">
          <Text className="text-zinc-300 mb-2 font-semibold">Master Password</Text>
          <TextInput
            className="bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl text-lg"
            placeholder="Enter a strong passphrase..."
            placeholderTextColor="#52525B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <PasswordStrength password={password} />
        </View>

        <View className="mb-6">
          <Text className="text-zinc-300 mb-2 font-semibold">Confirm Password</Text>
          <TextInput
            className="bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl text-lg"
            placeholder="Confirm master password..."
            placeholderTextColor="#52525B"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
        </View>

        <View className="flex-row items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-700 mb-8">
          <View className="flex-1 pr-4">
            <Text className="text-white font-semibold mb-1">Enable Biometrics</Text>
            <Text className="text-zinc-400 text-xs">Unlock faster with Face ID or Fingerprint</Text>
          </View>
          <Switch
            value={useBiometrics}
            onValueChange={setUseBiometrics}
            trackColor={{ false: '#3F3F46', true: '#3B82F6' }}
            thumbColor="#FFF"
          />
        </View>

        <TouchableOpacity
          className={`bg-blue-500 p-4 rounded-xl items-center ${isProcessing ? 'opacity-50' : ''}`}
          onPress={handleSetup}
          disabled={isProcessing}
        >
          <Text className="text-white font-bold text-lg">
            {isProcessing ? 'Generating Keys...' : 'Create Vault'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
