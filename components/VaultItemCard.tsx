import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CustomAlert as Alert } from '../utils/alert';
import { Copy, CreditCard, Key, FileText, Star, Folder, ExternalLink } from 'lucide-react-native';
import { VaultEntry } from '../types/vault';
import { useVaultStore } from '../store/useVaultStore';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

interface Props {
  entry: VaultEntry;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}

export function VaultItemCard({ entry, onPress, onLongPress, selected }: Props) {
  const folders = useVaultStore(state => state.folders);
  const folder = folders.find(f => f.id === entry.folderId);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    // Auto-clear clipboard after 30 seconds for security
    setTimeout(async () => {
      const currentClipboard = await Clipboard.getStringAsync();
      if (currentClipboard === text) {
        await Clipboard.setStringAsync('');
      }
    }, 30000);
  };

  const handleCopy = () => {
    if (entry.username && entry.password) {
      Alert.alert('Copy to Clipboard', 'Choose what to copy:', [
        { text: 'Username', onPress: () => copyToClipboard(entry.username!) },
        { text: 'Password', onPress: () => copyToClipboard(entry.password!) },
        { text: 'Cancel', style: 'cancel' }
      ]);
    } else if (entry.password) {
      copyToClipboard(entry.password);
    } else if (entry.username) {
      copyToClipboard(entry.username);
    }
  };

  const getIcon = () => {
    const iconColor = folder?.color || "#9CA3AF";
    switch (entry.category) {
      case 'Login': return <Key size={24} color={iconColor} />;
      case 'Card': return <CreditCard size={24} color={iconColor} />;
      case 'Secure Note': return <FileText size={24} color={iconColor} />;
      default: return <Key size={24} color={iconColor} />;
    }
  };

  return (
    <TouchableOpacity 
      className={`flex-row items-center p-4 mb-3 mx-4 rounded-2xl border transition-colors shadow-sm ${selected ? 'bg-blue-50 dark:bg-blue-900/20 border-brand' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 bg-zinc-50 dark:bg-zinc-950 rounded-xl items-center justify-center mr-4">
        {getIcon()}
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-zinc-900 dark:text-white font-bold text-lg" numberOfLines={1}>{entry.title}</Text>
        {entry.username ? (
          <Text className="text-zinc-500 dark:text-zinc-400 mt-1" numberOfLines={1}>{entry.username}</Text>
        ) : null}
      </View>
      
      <View className="flex-row items-center space-x-2 gap-2">
        {entry.favorite && (
          <View className="p-2">
            <Star size={18} color="#F59E0B" fill="#F59E0B" />
          </View>
        )}
        
        {entry.url && (
          <TouchableOpacity 
            onPress={() => Linking.openURL(entry.url!.startsWith('http') ? entry.url! : `https://${entry.url}`)} 
            className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg" 
            activeOpacity={0.6}
          >
            <ExternalLink size={18} color="#F5B971" />
          </TouchableOpacity>
        )}
        {(entry.password || entry.username) && (
          <TouchableOpacity onPress={handleCopy} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg" activeOpacity={0.6}>
            <Copy size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
