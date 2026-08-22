import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { LogOut, Download, Upload, Cloud, Plus } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useVaultStore } from '../../store/useVaultStore';
import { exportVaultFile, pickVaultFile, processVaultFile } from '../../services/exportService';
import { uploadToCloud } from '../../services/cloudBackupService';
import { saveVault } from '../../services/storageService';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ExportPayload, VaultFolder } from '../../types/vault';
import { ActionAuthModal } from '../../components/ActionAuthModal';

export default function SettingsScreen() {
  const router = useRouter();
  const { mek, lockVault } = useAuthStore();
  const { entries, setEntries } = useVaultStore();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Auth Action State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authTitle, setAuthTitle] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestAuth = (title: string, action: () => void) => {
    setAuthTitle(title);
    setPendingAction(() => action);
    setAuthModalVisible(true);
  };

  // Cloud Backup Modal State
  const [cloudModalVisible, setCloudModalVisible] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState('');

  // Export/Import Modal State
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [showCustomExportInput, setShowCustomExportInput] = useState(false);
  
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  
  const [importFolderModalVisible, setImportFolderModalVisible] = useState(false);
  const [importedEntries, setImportedEntries] = useState<any[]>([]);
  
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const FOLDER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

  const handleExport = async (useMasterPassword: boolean) => {
    if (!mek) return;
    if (!useMasterPassword && !exportPassword) return;
    
    setIsProcessing(true);
    
    useAuthStore.getState().setIgnoreAppBackground(true);
    try {
      // Small timeout to allow the UI to re-render the ActivityIndicator
      await new Promise(resolve => setTimeout(resolve, 50));
      const payload: ExportPayload = {
        version: 1,
        timestamp: Date.now(),
        entries,
      };
      await exportVaultFile(payload, useMasterPassword ? undefined : exportPassword, mek, useMasterPassword);
      setExportModalVisible(false);
      setShowCustomExportInput(false);
    } catch (error: any) {
      Alert.alert('Export Failed', error.message);
    } finally {
      setIsProcessing(false);
      setExportPassword('');
      // Slight delay before re-enabling auto-lock to allow OS to transition back fully
      setTimeout(() => useAuthStore.getState().setIgnoreAppBackground(false), 1000);
    }
  };

  const handlePickFile = async () => {
    useAuthStore.getState().setIgnoreAppBackground(true);
    try {
      const uri = await pickVaultFile();
      if (uri) {
        setSelectedFileUri(uri);
        setImportModalVisible(true);
      }
    } catch (error: any) {
      Alert.alert('File Picker Error', error.message);
    } finally {
      setTimeout(() => useAuthStore.getState().setIgnoreAppBackground(false), 1000);
    }
  };

  const handleImportSubmit = async () => {
    if (!importPassword || !selectedFileUri) return;
    setIsProcessing(true);
    
    try {
      // Small timeout to allow the UI to re-render the ActivityIndicator
      await new Promise(resolve => setTimeout(resolve, 50));
      const importedPayload = await processVaultFile(selectedFileUri, importPassword);
      if (importedPayload && importedPayload.entries && importedPayload.entries.length > 0) {
        setImportedEntries(importedPayload.entries);
        setImportModalVisible(false);
        setImportFolderModalVisible(true);
      } else {
        Alert.alert('Import Failed', 'No entries found in the selected file.');
        setImportModalVisible(false);
      }
    } catch (error: any) {
      Alert.alert('Import Failed', error.message);
      // Keep modal open so they can try the password again
    } finally {
      setIsProcessing(false);
      setImportPassword('');
    }
  };

  const finalizeImport = async (folderId: string) => {
    if (!mek) return;
    setImportFolderModalVisible(false);
    setIsCreatingFolder(false);
    
    // Map imported entries to new ID and target folder to avoid ID conflicts
    const newEntriesToMerge = importedEntries.map(e => ({
      ...e,
      id: Crypto.randomUUID(),
      folderId: folderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));

    const merged = [...entries, ...newEntriesToMerge];
    const { folders } = useVaultStore.getState();
    
    setEntries(merged);
    await saveVault({ version: 1, timestamp: Date.now(), entries: merged, folders }, mek);
    
    Alert.alert('Import Successful', `Added ${newEntriesToMerge.length} entries to your vault.`);
    setImportedEntries([]);
  };

  const handleCreateNewFolderAndImport = async () => {
    if (!newFolderName.trim()) return;
    
    const newFolder: VaultFolder = {
      id: Crypto.randomUUID(),
      name: newFolderName.trim(),
      color: newFolderColor,
      createdAt: Date.now()
    };
    
    await useVaultStore.getState().addFolder(newFolder);
    await finalizeImport(newFolder.id);
    setNewFolderName('');
  };

  const handleCloudBackup = async () => {
    if (!mek || !presignedUrl) return;
    setIsProcessing(true);
    try {
      const payload: ExportPayload = {
        version: 1,
        timestamp: Date.now(),
        entries,
      };
      await uploadToCloud(presignedUrl, payload, mek);
      Alert.alert('Success', 'Backup uploaded securely to the cloud.');
      setCloudModalVisible(false);
      setPresignedUrl('');
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLock = () => {
    lockVault();
    // Router will automatically redirect based on the _layout.tsx effect
  };

  const handleReset = () => {
    Alert.alert('Destroy Vault', 'This will permanently delete your vault and all passwords. This action cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Destroy', style: 'destructive', onPress: async () => {
          await SecureStore.deleteItemAsync('vault_salt');
          await SecureStore.deleteItemAsync('vault_mek');
          await SecureStore.deleteItemAsync('has_biometric_mek');
          lockVault();
          router.replace('/(auth)/setup');
      }}
    ]);
  };

  return (
    <ScrollView 
      className="flex-1 bg-zinc-950 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8">
        <Text className="text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Data Management</Text>
        <View className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <SettingRow icon={<Upload size={20} color="#3B82F6" />} label="Export Vault" onPress={() => requestAuth('Authenticate to Export', () => setExportModalVisible(true))} disabled={isProcessing} />
          <View className="h-[1px] bg-zinc-800 ml-12" />
          <SettingRow icon={<Download size={20} color="#10B981" />} label="Import Vault" onPress={handlePickFile} disabled={isProcessing} />
          <View className="h-[1px] bg-zinc-800 ml-12" />
          <SettingRow icon={<Cloud size={20} color="#8B5CF6" />} label="Cloud Backup" onPress={() => setCloudModalVisible(true)} disabled={isProcessing} />
        </View>
      </View>

      <View className="mb-8">
        <Text className="text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Security</Text>
        <View className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <SettingRow icon={<LogOut size={20} color="#F59E0B" />} label="Lock Vault" onPress={handleLock} />
        </View>
      </View>

      <View className="mb-8">
        <Text className="text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Danger Zone</Text>
        <View className="bg-zinc-900 rounded-2xl border border-red-900/30 overflow-hidden">
          <SettingRow icon={<LogOut size={20} color="#EF4444" />} label="Destroy Vault" onPress={handleReset} destructive />
        </View>
      </View>

      <Text className="text-zinc-600 text-center text-sm mt-4">Zero-Knowledge Architecture</Text>
      <Text className="text-zinc-700 text-center text-xs mt-1">AES-256-GCM Encrypted</Text>

      {/* Cloud Backup Modal */}
      <Modal visible={cloudModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700">
            <Text className="text-xl font-bold text-white mb-2">Cloud Backup</Text>
            <Text className="text-zinc-400 mb-6">Enter a pre-signed S3 PUT URL to securely upload your encrypted vault.</Text>
            
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl mb-6"
              placeholder="https://bucket.s3.amazonaws.com/..."
              placeholderTextColor="#52525B"
              value={presignedUrl}
              onChangeText={setPresignedUrl}
              autoCapitalize="none"
              multiline
            />
            
            <View className="flex-row space-x-4 gap-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-800 p-4 rounded-xl items-center"
                onPress={() => setCloudModalVisible(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 bg-purple-600 p-4 rounded-xl items-center ${!presignedUrl || isProcessing ? 'opacity-50' : ''}`}
                onPress={handleCloudBackup}
                disabled={!presignedUrl || isProcessing}
              >
                <Text className="text-white font-semibold">{isProcessing ? 'Uploading...' : 'Upload'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Password Modal */}
      <Modal visible={exportModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700">
            <Text className="text-xl font-bold text-white mb-2">Export Vault</Text>
            
            {!showCustomExportInput ? (
              <>
                <Text className="text-zinc-400 mb-6">Choose how to encrypt your exported vault file. If you use your Master Password, you won't need to create a new one.</Text>
                <View className="gap-3 space-y-3">
                  <TouchableOpacity 
                    className={`bg-blue-600 p-4 rounded-xl items-center flex-row justify-center ${isProcessing ? 'opacity-50' : ''}`}
                    onPress={() => handleExport(true)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text className="text-white font-semibold">Use Master Password</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="bg-zinc-800 p-4 rounded-xl items-center"
                    onPress={() => setShowCustomExportInput(true)}
                    disabled={isProcessing}
                  >
                    <Text className="text-white font-semibold">Create Custom Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="bg-transparent border border-zinc-700 p-4 rounded-xl items-center mt-2"
                    onPress={() => { setExportModalVisible(false); }}
                    disabled={isProcessing}
                  >
                    <Text className="text-white font-semibold">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text className="text-zinc-400 mb-6">Create a password to encrypt this backup file. You'll need this password to import it later.</Text>
                <TextInput
                  className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl mb-6"
                  placeholder="Backup Password"
                  placeholderTextColor="#52525B"
                  secureTextEntry
                  value={exportPassword}
                  onChangeText={setExportPassword}
                  autoCapitalize="none"
                />
                
                <View className="flex-row space-x-4 gap-4">
                  <TouchableOpacity 
                    className="flex-1 bg-zinc-800 p-4 rounded-xl items-center"
                    onPress={() => { setShowCustomExportInput(false); setExportPassword(''); }}
                  >
                    <Text className="text-white font-semibold">Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className={`flex-1 bg-blue-600 p-4 rounded-xl items-center flex-row justify-center ${!exportPassword || isProcessing ? 'opacity-50' : ''}`}
                    onPress={() => handleExport(false)}
                    disabled={!exportPassword || isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-white font-semibold">Export</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Import Password Modal */}
      <Modal visible={importModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700">
            <Text className="text-xl font-bold text-white mb-2">Import Vault</Text>
            <Text className="text-zinc-400 mb-6">Enter the password that was used to encrypt this backup file.</Text>
            
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl mb-6"
              placeholder="Backup Password"
              placeholderTextColor="#52525B"
              secureTextEntry
              value={importPassword}
              onChangeText={setImportPassword}
              autoCapitalize="none"
            />
            
            <View className="flex-row space-x-4 gap-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-800 p-4 rounded-xl items-center"
                onPress={() => { setImportModalVisible(false); setImportPassword(''); setSelectedFileUri(null); }}
                disabled={isProcessing}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 bg-blue-600 p-4 rounded-xl items-center flex-row justify-center ${!importPassword || isProcessing ? 'opacity-50' : ''}`}
                onPress={handleImportSubmit}
                disabled={!importPassword || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Decrypt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Target Folder Modal */}
      <Modal visible={importFolderModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 rounded-t-3xl border-t border-zinc-700 p-6 pb-12 max-h-[80%]">
            <Text className="text-xl font-bold text-white mb-2">Import Location</Text>
            <Text className="text-zinc-400 mb-6">Select a folder to add these {importedEntries.length} imported entries into.</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
              {/* New Folder Option */}
              {isCreatingFolder ? (
                <View className="mb-4 p-4 border border-zinc-700 rounded-xl bg-zinc-950">
                  <TextInput
                    className="text-white font-semibold text-lg border-b border-zinc-800 pb-2 mb-4"
                    placeholder="New Folder Name"
                    placeholderTextColor="#52525B"
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    autoFocus
                    autoCapitalize="none"
                  />
                  <Text className="text-zinc-400 mb-2 ml-1 text-sm">Color</Text>
                  <View className="flex-row flex-wrap gap-3 mb-6">
                    {FOLDER_COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setNewFolderColor(color)}
                        className={`w-8 h-8 rounded-full border-2 ${newFolderColor === color ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </View>
                  <View className="flex-row space-x-3 gap-3">
                    <TouchableOpacity 
                      className="flex-1 bg-zinc-800 p-3 rounded-lg items-center"
                      onPress={() => setIsCreatingFolder(false)}
                    >
                      <Text className="text-white">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      className={`flex-1 bg-blue-600 p-3 rounded-lg items-center ${!newFolderName.trim() ? 'opacity-50' : ''}`}
                      onPress={handleCreateNewFolderAndImport}
                      disabled={!newFolderName.trim()}
                    >
                      <Text className="text-white font-semibold">Create & Import</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  className="flex-row items-center p-4 border-b border-zinc-800"
                  onPress={() => {
                    setNewFolderName('');
                    setNewFolderColor('#3B82F6');
                    setIsCreatingFolder(true);
                  }}
                >
                  <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-4">
                    <Plus color="#3B82F6" size={20} />
                  </View>
                  <Text className="text-blue-400 font-semibold text-lg">Create New Folder</Text>
                </TouchableOpacity>
              )}
              
              {useVaultStore.getState().folders.map(folder => (
                <TouchableOpacity 
                  key={folder.id} 
                  className="flex-row items-center p-4 border-b border-zinc-800"
                  onPress={() => finalizeImport(folder.id)}
                >
                  <View className="w-4 h-4 rounded-full mr-4" style={{ backgroundColor: folder.color }} />
                  <Text className="text-white font-semibold text-lg">{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              className="bg-zinc-800 p-4 rounded-xl items-center mb-4"
              onPress={() => {
                setImportFolderModalVisible(false);
                setSelectedFileUri(null);
                setImportedEntries([]);
              }}
            >
              <Text className="text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Auth Modal */}
      <ActionAuthModal 
        visible={authModalVisible}
        title={authTitle}
        onCancel={() => setAuthModalVisible(false)}
        onSuccess={() => {
          setAuthModalVisible(false);
          if (pendingAction) {
            setTimeout(() => {
              pendingAction();
              setPendingAction(null);
            }, 300);
          }
        }}
      />
    </ScrollView>
  );
}

function SettingRow({ icon, label, onPress, destructive = false, disabled = false }: any) {
  return (
    <TouchableOpacity 
      className={`flex-row items-center p-4 ${disabled ? 'opacity-50' : ''}`} 
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View className="w-8">{icon}</View>
      <Text className={`text-base flex-1 ${destructive ? 'text-red-500 font-semibold' : 'text-white'}`}>{label}</Text>
    </TouchableOpacity>
  );
}
