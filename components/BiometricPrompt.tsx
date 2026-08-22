import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Fingerprint } from 'lucide-react-native';

interface Props {
  onAuthenticate: () => void;
}

export function BiometricPrompt({ onAuthenticate }: Props) {
  return (
    <View className="items-center justify-center py-6">
      <TouchableOpacity 
        onPress={onAuthenticate}
        activeOpacity={0.7}
        className="items-center justify-center bg-zinc-800 p-6 rounded-full border border-zinc-700"
      >
        <Fingerprint size={48} color="#60A5FA" />
      </TouchableOpacity>
      <Text className="text-zinc-400 mt-4 text-center">
        Tap to unlock with Biometrics
      </Text>
    </View>
  );
}
