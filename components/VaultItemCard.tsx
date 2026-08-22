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
      className={`flex-row items-center p-4 mb-3 rounded-2xl border transition-colors ${selected ? 'bg-blue-900/20 border-blue-500' : 'bg-zinc-800 border-zinc-700 active:bg-zinc-700'}`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-full bg-zinc-900 items-center justify-center mr-4">
        {getIcon()}
      </View>
      <View className="flex-1">
        <Text className="text-white font-semibold text-lg" numberOfLines={1}>
          {entry.title}
        </Text>
        <View className="flex-row items-center mt-0.5 space-x-2 gap-2">
          {folder && (
            <View className="flex-row items-center space-x-1 gap-1 bg-zinc-900/50 px-2 py-0.5 rounded-md border border-zinc-700/50">
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
              <Text className="text-zinc-500 text-xs">{folder.name}</Text>
            </View>
          )}
          {entry.username && (
            <Text className="text-zinc-400 text-sm flex-shrink" numberOfLines={1}>
              {entry.username}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center space-x-3 gap-3">
        {entry.favorite && <Star size={20} color="#FBBF24" fill="#FBBF24" />}
        {entry.url && (
          <TouchableOpacity 
            onPress={() => {
              const formattedUrl = entry.url!.startsWith('http') ? entry.url! : `https://${entry.url}`;
              Linking.openURL(formattedUrl).catch(() => Alert.alert('Error', 'Failed to open URL.'));
            }} 
            className="p-2 bg-blue-500/20 rounded-full" 
            activeOpacity={0.6}
          >
            <ExternalLink size={18} color="#3B82F6" />
          </TouchableOpacity>
        )}
        {(entry.password || entry.username) && (
          <TouchableOpacity onPress={handleCopy} className="p-2 bg-zinc-700 rounded-full" activeOpacity={0.6}>
            <Copy size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
