import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator, Switch, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { LogOut, Download, Upload, Cloud, Plus, Info, Fingerprint, Eye, EyeOff, Lock, Shield, Key, FileText, ShieldCheck, Sun, Moon, Hash, Settings as SettingsIcon } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useVaultStore } from '../../store/useVaultStore';
import { useThemeStore } from '../../store/useThemeStore';
import { exportVaultFile, pickVaultFile, processVaultFile } from '../../services/exportService';
import { uploadToCloud } from '../../services/cloudBackupService';
import { saveVault, destroyVault } from '../../services/storageService';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ExportPayload, VaultFolder } from '../../types/vault';
import { ActionAuthModal } from '../../components/ActionAuthModal';
import { ImportFormatType, parseUniversalFile } from '../../services/universalImportService';

export default function SettingsScreen() {
  const router = useRouter();
  const { mek, lockVault } = useAuthStore();
  const { entries, setEntries } = useVaultStore();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Auth Action State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authTitle, setAuthTitle] = useState('');
  const [authForcePassword, setAuthForcePassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('has_biometric_mek').then(val => {
      setBiometricsEnabled(val === 'true');
    });
  }, []);

  const handleToggleBiometrics = (newValue: boolean) => {
    // Revert switch visually until auth succeeds
    setBiometricsEnabled(!newValue);
    
    requestAuth('Authenticate to change security settings', async () => {
      if (newValue) {
        if (mek) {
          await SecureStore.setItemAsync('vault_mek', Buffer.from(mek).toString('base64'));
          await SecureStore.setItemAsync('has_biometric_mek', 'true');
          setBiometricsEnabled(true);
        }
      } else {
        await SecureStore.deleteItemAsync('vault_mek');
        await SecureStore.deleteItemAsync('has_biometric_mek');
        setBiometricsEnabled(false);
      }
    }, true); // Force Master Password instead of biometric prompt
  };

  const requestAuth = (title: string, action: () => void, forcePassword = false) => {
    setAuthTitle(title);
    setAuthForcePassword(forcePassword);
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
  const [importMode, setImportMode] = useState<'native' | 'third_party'>('native');
  const [selectedThirdPartyService, setSelectedThirdPartyService] = useState<ImportFormatType | null>(null);
  const [thirdPartyModalVisible, setThirdPartyModalVisible] = useState(false);
  const { theme, setTheme } = useThemeStore();
  
  const [importFolderModalVisible, setImportFolderModalVisible] = useState(false);
  const [importedEntries, setImportedEntries] = useState<any[]>([]);
  const [showImportPassword, setShowImportPassword] = useState(false);
  
  // Destroy Flow State
  const [destroyModalVisible, setDestroyModalVisible] = useState(false);
  const [understandDestroy, setUnderstandDestroy] = useState(false);
  const [backupPromptVisible, setBackupPromptVisible] = useState(false);
  const [isPreDestroyExport, setIsPreDestroyExport] = useState(false);
  

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#F5B971');
  const FOLDER_COLORS = ['#F5B971', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];

  const executeExport = async (useMasterPassword: boolean) => {
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
        folders: useVaultStore.getState().folders
      };
      
      await exportVaultFile(payload, useMasterPassword ? undefined : exportPassword, mek, useMasterPassword, isPreDestroyExport);
      
      setExportModalVisible(false);
      setExportPassword('');
      setShowCustomExportInput(false);
      // Slight delay before re-enabling auto-lock to allow OS to transition back fully
      setTimeout(() => useAuthStore.getState().setIgnoreAppBackground(false), 1000);
      
      if (isPreDestroyExport) {
        setIsPreDestroyExport(false);
        setTimeout(() => executeWipe(), 500);
      }
    } catch (error: any) {
      Alert.alert('Export Error', error.message);
      setIsPreDestroyExport(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = (useMasterPassword: boolean) => {
    if (isPreDestroyExport) {
      requestAuth('Final Confirmation', () => executeExport(useMasterPassword), false);
    } else {
      executeExport(useMasterPassword);
    }
  };

  const executeWipe = async () => {
    setIsProcessing(true);
    try {
      await SecureStore.deleteItemAsync('vault_salt');
      await SecureStore.deleteItemAsync('vault_mek');
      await SecureStore.deleteItemAsync('has_biometric_mek');
      await destroyVault();
      useVaultStore.getState().clearVault();
      lockVault(); // triggers route drop
    } catch (e) {
      Alert.alert('Error', 'Failed to wipe device data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickFile = async () => {
    useAuthStore.getState().setIgnoreAppBackground(true);
    try {
      const fileUri = await pickVaultFile();
      if (fileUri) {
        setSelectedFileUri(fileUri);
        setImportMode('native');
        setImportModalVisible(true);
      }
    } catch (error: any) {
      Alert.alert('File Picker Error', error.message);
    } finally {
      setTimeout(() => useAuthStore.getState().setIgnoreAppBackground(false), 1000);
    }
  };

  const handlePickThirdPartyFile = async (format: ImportFormatType) => {
    setThirdPartyModalVisible(false);
    
    // Catch unsupported formats immediately
    if (format === 'Unsupported Formats Help' as any) {
       Alert.alert(
         'Unsupported Formats',
         'Encrypted or zipped formats like .kdbx (KeePass), .1pux (1Password), or .zip (ProtonPass) cannot be imported directly into the mobile app.\n\nPlease open those apps and export as an "Unencrypted CSV" or "Unencrypted JSON", which we fully support!'
       );
       return;
    }
    
    requestAuth(`Authenticate to Import ${format}`, async () => {
      useAuthStore.getState().setIgnoreAppBackground(true);
      try {
        const fileUri = await pickVaultFile();
        if (fileUri) {
          setSelectedFileUri(fileUri);
          setSelectedThirdPartyService(format);
          setImportMode('third_party');
          
          setIsProcessing(true);
          try {
            // Third-party files (CSV or JSON) are not encrypted with a Master Password, we parse directly
            const entries = await parseUniversalFile(fileUri, format, 'temp');
            
            if (entries.length === 0) {
              Alert.alert('No Entries Found', `We couldn't find any valid passwords in this file. Are you sure this is a valid ${format} export?`);
              setSelectedFileUri(null);
              return;
            }
            
            setImportedEntries(entries);
            setNewFolderName('');
            setThirdPartyModalVisible(false);
            setTimeout(() => {
              setImportFolderModalVisible(true);
            }, 300);
          } catch (error: any) {
            Alert.alert('Import Failed', error.message);
            setSelectedFileUri(null);
          } finally {
            setIsProcessing(false);
          }
        }
      } catch (error: any) {
        Alert.alert('File Picker Error', error.message);
      } finally {
        setTimeout(() => useAuthStore.getState().setIgnoreAppBackground(false), 1000);
      }
    });
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
        setNewFolderName('');
        setTimeout(() => {
          setImportFolderModalVisible(true);
        }, 300);
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
    setIsProcessing(true);
    
    try {
      // Small timeout to allow the UI to re-render the ActivityIndicator
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Map imported entries to new ID and target folder to avoid ID conflicts
      const newEntriesToMerge = importedEntries.map(e => ({
        ...e,
        id: Crypto.randomUUID(),
        folderId: folderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));

      const newVaultData = {
        entries: [...useVaultStore.getState().entries, ...newEntriesToMerge],
        folders: useVaultStore.getState().folders
      };

      await saveVault(newVaultData, mek);
      setEntries(newVaultData.entries);
      
      setImportFolderModalVisible(false);
      setSelectedFileUri(null);
      setImportedEntries([]);
      
      setTimeout(() => {
        Alert.alert('Import Successful', `Successfully imported ${newEntriesToMerge.length} passwords!`);
      }, 300);
    } catch (error: any) {
      Alert.alert('Import Failed', 'Failed to save imported entries.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewFolderAndImport = async () => {
    if (!newFolderName.trim()) return;
    setIsProcessing(true);
    
    // Small timeout to allow UI to render spinner
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const newFolder: VaultFolder = {
      id: Crypto.randomUUID(),
      name: newFolderName.trim(),
      color: newFolderColor,
      createdAt: Date.now()
    };
    
    await useVaultStore.getState().addFolder(newFolder);
    await finalizeImport(newFolder.id);
    setNewFolderName('');
    // finalizeImport already sets isProcessing to false
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
    setUnderstandDestroy(false);
    setDestroyModalVisible(true);
  };

  return (
    <ScrollView 
      className="flex-1 bg-[#f4f4f5] dark:bg-[#09090b]"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="pt-16 pb-6 px-2">
        <Text className="text-3xl font-bold text-zinc-900 dark:text-white">Settings</Text>
      </View>
      <View className="mb-6">
        <Text className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Appearance</Text>
        <View className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <SettingRow 
            icon={theme === 'dark' ? <Moon size={20} color="#8B5CF6" /> : <Sun size={20} color="#F59E0B" />} 
            label="Dark Mode" 
            subtitle={theme === 'dark' ? 'On' : 'Off'}
            rightElement={
              <Switch 
                value={theme === 'dark'} 
                onValueChange={(val) => setTheme(val ? 'dark' : 'light')} 
                trackColor={{ false: '#e4e4e7', true: '#F5B971' }}
                thumbColor="#ffffff"
              />
            }
          />
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Security</Text>
        <View className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <SettingRow icon={<Key size={20} color="#52525B" />} label="Change Pass Key" subtitle="AES-256 encryption key — re-encrypts all files" onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')} rightElement={<Lock size={16} color="#D9A05B" />} />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow 
            icon={<Fingerprint size={20} color="#3B82F6" />} 
            label="Biometric Lock" 
            subtitle={biometricsEnabled ? 'Enabled — tap to disable' : 'Disabled — tap to enable'}
            rightElement={
              <Switch 
                value={biometricsEnabled} 
                onValueChange={handleToggleBiometrics} 
                trackColor={{ false: '#e4e4e7', true: '#F5B971' }}
                thumbColor="#ffffff"
              />
            }
          />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow icon={<LogOut size={20} color="#F5B971" />} label="Lock Vault" subtitle="Returns to login screen" onPress={handleLock} />
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Data</Text>
        <View className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <SettingRow icon={<Upload size={20} color="#F5B971" />} label="Export Vault" subtitle="Create an encrypted backup file" onPress={() => requestAuth('Authenticate to Export', () => setExportModalVisible(true))} disabled={isProcessing} />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow icon={<Download size={20} color="#10B981" />} label="Import .vault Backup" subtitle="Restore from a previous backup file" onPress={() => requestAuth('Authenticate to Import', handlePickFile)} disabled={isProcessing} />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow icon={<Download size={20} color="#F59E0B" />} label="Import from Other Services" subtitle="CSV import from Bitwarden, etc." onPress={() => setThirdPartyModalVisible(true)} disabled={isProcessing} />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow icon={<Cloud size={20} color="#52525B" />} label="Cloud Backup" subtitle="Coming soon" onPress={() => Alert.alert('Coming Soon', 'Cloud backup functionality is currently under development.')} disabled={isProcessing} rightElement={<Lock size={16} color="#D9A05B" />} />
        </View>
      </View>

      <View className="mb-6">
        <Text className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">About</Text>
        <View className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <SettingRow icon={<FileText size={20} color="#52525B" />} label="Terms of Use" onPress={() => {}} rightElement={<Lock size={16} color="#D9A05B" />} />
          <View className="h-[1px] bg-zinc-100 dark:bg-zinc-800 ml-16" />
          <SettingRow icon={<Info size={20} color="#10B981" />} label="Version" subtitle="nkrypt v2.0.0" onPress={() => {}} />
        </View>
      </View>

      <View className="mb-12">
        <Text className="text-zinc-500 dark:text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2 ml-2">Danger Zone</Text>
        <View className="bg-red-50 dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/30 overflow-hidden shadow-sm">
          <SettingRow icon={<LogOut size={20} color="#EF4444" />} label="Wipe All Data" subtitle="Permanently deletes everything" onPress={handleReset} destructive />
        </View>
      </View>

      {/* Cloud Backup Modal */}
      <Modal visible={cloudModalVisible} animationType="slide" transparent onRequestClose={() => setCloudModalVisible(false)}>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700">
            <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Cloud Backup</Text>
            <Text className="text-zinc-500 dark:text-zinc-400 mb-6">Enter a pre-signed S3 PUT URL to securely upload your encrypted vault.</Text>
            
            <TextInput
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl mb-6"
              placeholder="https://bucket.s3.amazonaws.com/..."
              placeholderTextColor="#9CA3AF"
              value={presignedUrl}
              onChangeText={setPresignedUrl}
              autoCapitalize="none"
              multiline
            />
            
            <View className="flex-row space-x-4 gap-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-200 dark:bg-zinc-800 p-4 rounded-xl items-center"
                onPress={() => setCloudModalVisible(false)}
              >
                <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
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
      <Modal visible={exportModalVisible} animationType="slide" transparent onRequestClose={() => setExportModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white dark:bg-zinc-900 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-700 p-6 pb-12">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Export Vault</Text>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-6">Your exported file will be fully encrypted. Choose how you want to encrypt it.</Text>
              
              {!showCustomExportInput ? (
                <View className="gap-4 mb-6">
                  <TouchableOpacity 
                    className="bg-brand p-4 rounded-xl flex-row items-center"
                    onPress={() => handleExport(true)}
                    disabled={isProcessing}
                  >
                    <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-4">
                      <LogOut color="#FFF" size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-lg">Use Master Password</Text>
                      <Text className="text-blue-100 text-sm">Recommended. Use your current Master Password to encrypt the file.</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl flex-row items-center"
                    onPress={() => setShowCustomExportInput(true)}
                  >
                    <View className="flex-1">
                      <Text className="text-zinc-900 dark:text-white font-bold text-lg">Use Custom Password</Text>
                      <Text className="text-zinc-500 dark:text-zinc-400 text-sm">Create a one-time password specifically for this export file.</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="mb-6">
                  <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1">Custom Export Password</Text>
                  <TextInput
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl text-lg text-center mb-6"
                    placeholder="Enter custom password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={exportPassword}
                    onChangeText={setExportPassword}
                    autoFocus
                    autoCapitalize="none"
                    autoComplete="off"
                    importantForAutofill="no"
                    textContentType="none"
                  />
                  <TouchableOpacity 
                    className={`bg-brand p-4 rounded-xl items-center flex-row justify-center ${(!exportPassword || isProcessing) ? 'opacity-50' : ''}`}
                    onPress={() => handleExport(false)}
                    disabled={!exportPassword || isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-lg">Export File</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              <TouchableOpacity 
                className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center mb-4"
                onPress={() => {
                  setExportModalVisible(false);
                  setShowCustomExportInput(false);
                  setExportPassword('');
                }}
              >
                <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Import Password Modal */}
      <Modal visible={importModalVisible} animationType="slide" transparent onRequestClose={() => setImportModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white dark:bg-zinc-900 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-700 p-6 pb-12">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Import Vault</Text>
              
              <View className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 flex-row items-center mt-4">
                <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-4">
                  <Upload color="#10B981" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-900 dark:text-white font-bold">File Selected</Text>
                  <Text className="text-zinc-500 text-xs" numberOfLines={1}>{selectedFileUri}</Text>
                </View>
              </View>

              <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1">Password</Text>
              <View className="relative mb-6 justify-center">
                <TextInput
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl text-lg text-center pr-12"
                  placeholder="Enter password to decrypt file"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showImportPassword}
                  value={importPassword}
                  onChangeText={setImportPassword}
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                />
                <TouchableOpacity 
                  className="absolute right-4"
                  onPress={() => setShowImportPassword(!showImportPassword)}
                >
                  {showImportPassword ? <EyeOff color="#9CA3AF" size={24} /> : <Eye color="#9CA3AF" size={24} />}
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-4 mb-4">
                <TouchableOpacity 
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center"
                  onPress={() => {
                    setImportModalVisible(false);
                    setImportPassword('');
                    setShowImportPassword(false);
                    setSelectedFileUri(null);
                  }}
                  disabled={isProcessing}
                >
                  <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`flex-1 bg-brand p-4 rounded-xl flex-row items-center justify-center ${(!importPassword || isProcessing) ? 'opacity-50' : ''}`}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Third Party Import Selection Modal */}
      <Modal visible={thirdPartyModalVisible} animationType="slide" transparent onRequestClose={() => setThirdPartyModalVisible(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white dark:bg-zinc-900 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-700 p-6 pb-12 max-h-[80%]">
            <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Import from Other Services</Text>
            <Text className="text-zinc-500 dark:text-zinc-400 mb-6">Select the format of the file you exported from your previous password manager.</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} className="mb-6" keyboardShouldPersistTaps="handled">
              {[
                { name: 'Import CSV File', format: 'CSV', desc: 'Chrome, LastPass, 1Password, etc.' },
                { name: 'Import JSON File', format: 'JSON', desc: 'Bitwarden, Dashlane, Enpass, etc.' },
                { name: 'Import XML File', format: 'XML', desc: 'KeePass 2, SafeInCloud, etc.' },
                { name: 'Unsupported Formats Help', format: 'Unsupported Formats Help', desc: '1PUX, KDBX, ZIP, etc.' }
              ].map(item => (
                <TouchableOpacity 
                  key={item.format}
                  className="p-4 border-b border-zinc-800"
                  onPress={() => handlePickThirdPartyFile(item.format as any)}
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-brand/20 items-center justify-center mr-4">
                      {item.format === 'Unsupported Formats Help' ? <Info color="#F5B971" size={20} /> : <Download color="#F5B971" size={20} />}
                    </View>
                    <View>
                      <Text className="text-zinc-900 dark:text-white font-semibold text-lg">{item.name}</Text>
                      <Text className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{item.desc}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center mb-4"
              onPress={() => setThirdPartyModalVisible(false)}
            >
              <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import Target Folder Modal */}
      <Modal visible={importFolderModalVisible} animationType="slide" transparent onRequestClose={() => setImportFolderModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white dark:bg-zinc-900 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-700 p-6 pb-12 max-h-[80%]">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Import Location</Text>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-6">Select a folder to add these {importedEntries.length} imported entries into.</Text>
              
              <ScrollView showsVerticalScrollIndicator={false} className="mb-6" keyboardShouldPersistTaps="handled">
                {/* New Folder Option */}
                <View className="mb-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-950">
                  <TextInput
                    className="text-zinc-900 dark:text-white font-semibold text-lg border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4"
                    placeholder="New Folder Name"
                    placeholderTextColor="#9CA3AF"
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                    autoCapitalize="none"
                  />
                  <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1 text-sm">Color</Text>
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
                  <TouchableOpacity 
                    className={`bg-brand p-4 rounded-xl items-center flex-row justify-center ${(!newFolderName.trim() || isProcessing) ? 'opacity-50' : ''}`}
                    onPress={handleCreateNewFolderAndImport}
                    disabled={!newFolderName.trim() || isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-white font-semibold text-lg">Create & Import</Text>
                    )}
                  </TouchableOpacity>
                </View>
                
                {useVaultStore.getState().folders.map(folder => (
                  <TouchableOpacity 
                    key={folder.id} 
                    className="flex-row items-center p-4 border-b border-zinc-100 dark:border-zinc-800"
                    onPress={() => finalizeImport(folder.id)}
                  >
                    <View className="w-4 h-4 rounded-full mr-4" style={{ backgroundColor: folder.color }} />
                    <Text className="text-zinc-900 dark:text-white font-semibold text-lg">{folder.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity 
                className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center mb-4"
                onPress={() => {
                  setImportFolderModalVisible(false);
                  setSelectedFileUri(null);
                  setImportedEntries([]);
                }}
              >
                <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Action Auth Modal */}
      <ActionAuthModal 
        visible={authModalVisible}
        title={authTitle}
        forcePassword={authForcePassword}
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
      {/* Destroy Vault Modal */}
      <Modal visible={destroyModalVisible} animationType="slide" transparent onRequestClose={() => setDestroyModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-center p-6">
            <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-red-200 dark:border-red-900/30">
              <Text className="text-xl font-bold text-red-500 mb-2">Warning: Destroy Vault</Text>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-6">This action will permanently delete all your encrypted data, passwords, and security settings. This cannot be undone.</Text>
              
              <TouchableOpacity 
                className="flex-row items-center space-x-3 mb-6 gap-3"
                onPress={() => setUnderstandDestroy(!understandDestroy)}
                activeOpacity={0.7}
              >
                <View className={`w-6 h-6 rounded border items-center justify-center ${understandDestroy ? 'bg-red-500 border-red-500' : 'border-zinc-300 dark:border-zinc-500'}`}>
                  {understandDestroy && <Text className="text-white font-bold text-xs">✓</Text>}
                </View>
                <Text className="text-zinc-600 dark:text-zinc-300 flex-1">I understand this will permanently delete all my data.</Text>
              </TouchableOpacity>
              
              <View className="flex-row gap-4">
                <TouchableOpacity 
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center"
                  onPress={() => setDestroyModalVisible(false)}
                >
                  <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`flex-1 bg-red-600 p-4 rounded-xl items-center ${!understandDestroy ? 'opacity-50' : ''}`}
                  onPress={() => {
                    setDestroyModalVisible(false);
                    setBackupPromptVisible(true);
                  }}
                  disabled={!understandDestroy}
                >
                  <Text className="text-white font-semibold">Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Backup Prompt Modal */}
      <Modal visible={backupPromptVisible} animationType="slide" transparent onRequestClose={() => setBackupPromptVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-center p-6">
            <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Create Backup?</Text>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-4">Would you like to export your vault to a secure file before destroying it?</Text>
              
              <View className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 mb-6">
                <Text className="text-blue-800 dark:text-blue-300 text-xs text-center">
                  Backup will be automatically saved to:
                  {"\n"}<Text className="font-bold">Documents / Password Manager / vault backup</Text>
                </Text>
              </View>
              
              <TouchableOpacity 
                className="bg-brand p-4 rounded-xl items-center mb-4"
                onPress={() => {
                  setBackupPromptVisible(false);
                  setIsPreDestroyExport(true);
                  setExportModalVisible(true);
                }}
              >
                <Text className="text-white font-semibold">Export Vault Backup</Text>
              </TouchableOpacity>
              
              <View className="flex-row gap-4">
                <TouchableOpacity 
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center"
                  onPress={() => {
                    setBackupPromptVisible(false);
                  }}
                >
                  <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 bg-red-100 dark:bg-red-900/50 p-4 rounded-xl items-center"
                  onPress={() => {
                    setBackupPromptVisible(false);
                    requestAuth('Final Confirmation', executeWipe, false);
                  }}
                >
                  <Text className="text-red-700 dark:text-red-400 font-semibold">Skip & Destroy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function SettingRow({ icon, label, subtitle, onPress, destructive = false, disabled = false, rightElement }: any) {
  return (
    <TouchableOpacity 
      className={`flex-row items-center p-4 ${disabled ? 'opacity-50' : ''}`} 
      onPress={onPress}
      disabled={disabled || (!onPress && !rightElement)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 items-center justify-center mr-4">
        {icon}
      </View>
      <View className="flex-1 justify-center">
        <Text className={`text-base ${destructive ? 'text-red-600 dark:text-red-500 font-semibold' : 'text-zinc-900 dark:text-white'}`}>{label}</Text>
        {subtitle && <Text className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{subtitle}</Text>}
      </View>
      {rightElement ? <View>{rightElement}</View> : (onPress ? <Text className="text-zinc-300 dark:text-zinc-600 text-xl font-light">›</Text> : null)}
    </TouchableOpacity>
  );
}
