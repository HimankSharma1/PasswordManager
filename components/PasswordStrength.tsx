import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  password?: string;
}

export function PasswordStrength({ password = '' }: Props) {
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length > 8) score += 1;
    if (pwd.length > 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const score = calculateStrength(password);
  
  const getStrengthData = () => {
    if (password.length === 0) return { label: 'None', color: 'bg-zinc-700', width: 'w-0' };
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
    if (score === 3) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-2/4' };
    if (score === 4) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  const { label, color, width } = getStrengthData();

  return (
    <View className="mt-2 w-full">
      <View className="flex-row justify-between mb-1">
        <Text className="text-zinc-400 text-xs">Password Strength</Text>
        <Text className={`text-xs font-semibold ${color.replace('bg-', 'text-')}`}>{label}</Text>
      </View>
      <View className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden">
        <View className={`h-full rounded-full ${color} ${width}`} />
      </View>
    </View>
  );
}
