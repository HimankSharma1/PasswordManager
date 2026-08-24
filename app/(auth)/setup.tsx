import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView, Image, StyleSheet, Modal } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { useAuthStore } from '../../store/useAuthStore';
import { useVaultStore } from '../../store/useVaultStore';
import { deriveKey, generateSalt } from '../../services/cryptoService';
import { saveVault } from '../../services/storageService';
import { Square, CheckSquare, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';

export default function SetupScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const { setMEK, setBiometricEnabled } = useAuthStore();
  const { setEntries } = useVaultStore();

  const logoTranslateX = useSharedValue(0);
  const logoTranslateY = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const text1Opacity = useSharedValue(0);
  const text3Opacity = useSharedValue(0);
  const text1Scale = useSharedValue(0.9);
  const checkTranslateY = useSharedValue(20);
  const loaderRotation = useSharedValue(0);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: logoTranslateX.value },
      { translateY: logoTranslateY.value },
      { scale: logoScale.value }
    ]
  }));
  const text1Style = useAnimatedStyle(() => ({ 
    opacity: text1Opacity.value,
    transform: [{ scale: text1Scale.value }, { translateX: 55 }]
  }));
  const text3Style = useAnimatedStyle(() => ({ 
    opacity: text3Opacity.value,
    transform: [{ translateY: checkTranslateY.value }]
  }));
  const loaderStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${loaderRotation.value}deg` }]
  }));

  const handlePreSetup = () => {
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Master Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setShowWarningModal(true);
  };

  const executeSetup = async () => {
    setShowWarningModal(false);
    setIsProcessing(true);
    
    // Start Animation Overlay immediately
    setIsAnimating(true);
    
    // Start the loading spinner rotation indefinitely
    loaderRotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    
    setTimeout(async () => {
      // 1. Logo starts at center, move it left smoothly over 800ms
      logoTranslateX.value = withTiming(-115, { duration: 800, easing: Easing.inOut(Easing.cubic) });
      
      // 2. When logo hits exactly 90% distance (~700ms), bring in text
      setTimeout(() => {
        text1Opacity.value = withTiming(1, { duration: 400 });
        text1Scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      }, 700);

      // Block thread after text animation completes
      setTimeout(async () => {
        try {
          const salt = generateSalt();
          const mek = await deriveKey(password, salt);
          
          const saltBase64 = Buffer.from(salt).toString('base64');
          await SecureStore.setItemAsync('vault_salt', saltBase64);
          
          let biometricsSuccess = false;
          let showBiometricAlert = false;
          
          if (useBiometrics) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            
            if (hasHardware && isEnrolled) {
              const mekBase64 = Buffer.from(mek).toString('base64');
              await SecureStore.setItemAsync('vault_mek', mekBase64);
              await SecureStore.setItemAsync('has_biometric_mek', 'true');
              biometricsSuccess = true;
            } else {
              showBiometricAlert = true;
            }
          } else {
            await SecureStore.deleteItemAsync('vault_mek');
            await SecureStore.deleteItemAsync('has_biometric_mek');
          }

          await saveVault({ version: 1, timestamp: Date.now(), entries: [] }, mek);
          
          // 3. Crypto finished. Fade out text and glide logo back to center
          text1Opacity.value = withTiming(0, { duration: 400 });
          
          logoTranslateX.value = withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.cubic) });
          logoScale.value = withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.cubic) });
          
          // 4. Exactly when it hits the center (1000ms), glide it upward
          setTimeout(() => {
            logoTranslateY.value = withTiming(-80, { duration: 600, easing: Easing.inOut(Easing.cubic) });
            
            // 5. Fade in the success checkmark simultaneously as it goes up
            setTimeout(() => {
              text3Opacity.value = withTiming(1, { duration: 400 });
              checkTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
              
              // Finish and save keys
              setTimeout(() => {
                setIsProcessing(false);
                setBiometricEnabled(biometricsSuccess);
                setMEK(mek);
                
                if (showBiometricAlert) {
                  setTimeout(() => {
                    Alert.alert('Biometrics Unavailable', 'Device does not support or have biometrics configured.');
                  }, 500);
                }
              }, 1500);
              
            }, 300); // Fade in success message halfway through the upward glide
          }, 1000); // Wait for logo to hit exact center
          
        } catch (error) {
          Alert.alert('Error', 'Failed to setup vault. Please try again.');
          console.error(error);
          setIsProcessing(false);
          setIsAnimating(false);
        }
      }, 1500); // 700ms wait + 800ms animation buffer
    }, 200);
  };

  return (
    <>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-[#f4f4f5] dark:bg-[#09090b]"
      >
        <ScrollView 
          contentContainerStyle={{ padding: 24, flexGrow: 1, paddingTop: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-10">
            <View className="items-center justify-center mb-6 shadow-lg shadow-brand/20">
              <Image source={require('../../assets/images/logo.png')} className="w-24 h-24 rounded-3xl" />
            </View>
            <Text className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Welcome</Text>
            <Text className="text-brand font-semibold mb-4 text-center">Encrypt what matters. Do it smarter with Nkrypt.</Text>
            <Text className="text-zinc-600 dark:text-zinc-400 text-center text-base">Create your zero-knowledge master password. If you lose this, your data is gone forever.</Text>
          </View>
          
          <View className="mb-4">
            <Text className="text-zinc-700 dark:text-zinc-300 mb-2 font-semibold">Master Password</Text>
            <TextInput
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl text-lg shadow-sm"
              placeholder="Enter a strong passphrase..."
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="off"
              importantForAutofill="no"
              textContentType="none"
            />
          </View>

          <View className="mb-6">
            <Text className="text-zinc-700 dark:text-zinc-300 mb-2 font-semibold">Confirm Password</Text>
            <TextInput
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl text-lg shadow-sm"
              placeholder="Confirm master password..."
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoComplete="off"
              importantForAutofill="no"
              textContentType="none"
            />
          </View>

          <View className="flex-row items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-8 shadow-sm">
            <View className="flex-1 pr-4">
              <Text className="text-zinc-900 dark:text-white font-semibold mb-1">Enable Biometrics</Text>
              <Text className="text-zinc-500 dark:text-zinc-400 text-xs">Unlock faster with Face ID or Fingerprint</Text>
            </View>
            <Switch
              value={useBiometrics}
              onValueChange={setUseBiometrics}
              trackColor={{ false: '#e4e4e7', true: '#F5B971' }}
              thumbColor="#FFF"
            />
          </View>

          <TouchableOpacity
            className={`bg-brand p-4 rounded-xl items-center shadow-sm ${isProcessing ? 'opacity-50' : ''}`}
            onPress={handlePreSetup}
            disabled={isProcessing}
          >
            <Text className="text-white font-bold text-lg">
              {isProcessing ? 'Generating Keys...' : 'Create Vault'}
            </Text>
          </TouchableOpacity>

          <View className="mt-12 mb-4 items-center opacity-60">
            <Text className="text-zinc-500 dark:text-zinc-500 text-xs font-medium">Visible Comfort. Invisible Tech.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Warning & Acknowledgement Modal */}
      <Modal visible={showWarningModal} animationType="fade" transparent>
        <View className="flex-1 bg-black/60 justify-center p-6">
          <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
            
            <View className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30 mb-6">
              <View className="flex-row items-center mb-3">
                <AlertTriangle color="#EF4444" size={24} />
                <Text className="text-red-600 dark:text-red-500 font-bold ml-3 text-lg">Critical Warnings</Text>
              </View>
              <Text className="text-red-700 dark:text-red-400 text-sm mb-3 font-medium leading-5">• Nkrypt is completely offline. Your data never leaves your device.</Text>
              <Text className="text-red-700 dark:text-red-400 text-sm mb-3 font-medium leading-5">• If you forget your Master Password, your data is gone forever. There is no recovery option.</Text>
              <Text className="text-red-700 dark:text-red-400 text-sm font-medium leading-5">• Uninstalling the app or clearing its data will permanently delete your vault.</Text>
            </View>

            <TouchableOpacity 
              className="flex-row items-start mb-8 pr-2"
              onPress={() => setIsAcknowledged(!isAcknowledged)}
              activeOpacity={0.7}
            >
              <View className="mt-1">
                {isAcknowledged ? (
                  <CheckSquare color="#F5B971" size={26} />
                ) : (
                  <Square color="#9CA3AF" size={26} />
                )}
              </View>
              <Text className="text-zinc-700 dark:text-zinc-300 ml-4 flex-1 text-base leading-6 font-medium">
                I acknowledge that I am solely responsible for remembering my Master Password and backing up my data.
              </Text>
            </TouchableOpacity>

            <View className="flex-row gap-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center border border-zinc-200 dark:border-zinc-700"
                onPress={() => setShowWarningModal(false)}
              >
                <Text className="text-zinc-900 dark:text-white font-bold text-base">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className={`flex-1 bg-brand p-4 rounded-xl items-center shadow-sm ${!isAcknowledged ? 'opacity-50' : ''}`}
                onPress={executeSetup}
                disabled={!isAcknowledged}
              >
                <Text className="text-white font-bold text-base">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cinematic Custom Animation Sequence Overlay */}
      <Modal visible={isAnimating} animationType="fade" transparent={true}>
        <View style={StyleSheet.absoluteFill} className="bg-zinc-950/90 justify-center items-center">
          
          <Animated.View style={logoStyle} className="absolute z-10 shadow-2xl shadow-brand/30">
            <Image source={require('../../assets/images/logo.png')} className="w-24 h-24 rounded-3xl" />
          </Animated.View>
          
          {/* Strictly Centered Components utilizing translation offsets via useAnimatedStyle */}
          <Animated.View style={[text1Style, { position: 'absolute', width: 220, flexDirection: 'row', alignItems: 'center' }]} className="justify-center">
            <Animated.View style={loaderStyle} className="mr-3">
              <Loader2 color="#F5B971" size={26} />
            </Animated.View>
            <Text className="text-white font-semibold text-lg leading-7 flex-1">
              Creating the encrypted vault using Nkrypt...
            </Text>
          </Animated.View>
          
          <Animated.View style={[text3Style, { position: 'absolute', top: '50%', marginTop: 20, alignItems: 'center' }]}>
            <CheckCircle color="#22C55E" size={48} className="mb-4" />
            <Text className="text-green-500 font-bold text-2xl tracking-tight">Vault Secured...</Text>
          </Animated.View>
          
        </View>
      </Modal>
    </>
  );
}
