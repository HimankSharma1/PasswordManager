import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { CustomAlert as Alert } from '../../utils/alert';
import { Search, Plus, X, Eye, EyeOff, FolderInput, Trash2, CheckCheck } from 'lucide-react-native';
import { useVaultStore } from '../../store/useVaultStore';
import { VaultItemCard } from '../../components/VaultItemCard';
import { ActionAuthModal } from '../../components/ActionAuthModal';
import { VaultEntry, Category, VaultFolder } from '../../types/vault';
import 'react-native-get-random-values';
import * as Crypto from 'expo-crypto';

// Polyfill for uuid since we don't have uuid package yet
const generateId = () => Crypto.randomUUID();

export default function VaultScreen() {
  const { entries, folders, searchQuery, folderFilter, draftPassword, draftUsername, setSearchQuery, setFolderFilter, setDraftPassword, setDraftUsername, addEntry, updateEntry, deleteEntry, deleteEntries, moveEntries, addFolder, updateFolder, deleteFolder } = useVaultStore();
  const [modalVisible, setModalVisible] = useState(false);
  
  // Auth Action State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authTitle, setAuthTitle] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // New/Edit Entry Form State
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('login');
  const [newFolderId, setNewFolderId] = useState<string>('none');
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  
  // Folder State [showPassword, setShowPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // New/Edit Folder Modal State
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newFolderInputName, setNewFolderInputName] = useState('');
  const [newFolderInputColor, setNewFolderInputColor] = useState('#F5B971');
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const FOLDER_COLORS = ['#F5B971', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];

  useEffect(() => {
    if (draftPassword || draftUsername) {
      handleOpenAdd();
      if (draftPassword) setNewPassword(draftPassword);
      if (draftUsername) setNewUsername(draftUsername);
      setDraftPassword(null);
      setDraftUsername(null);
    }
  }, [draftPassword, draftUsername]);

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = folderFilter === 'All' || e.folderId === folderFilter;
    return matchesSearch && matchesFolder;
  });

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setNewTitle('');
    setNewUsername('');
    setNewPassword('');
    setNewUrl('');
    setNewCategory('login');
    setNewFolderId('default');
    setShowPassword(false);
    setModalVisible(true);
  };

  const handleOpenEdit = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setNewTitle(entry.title);
    setNewUsername(entry.username || '');
    setNewPassword(entry.password || '');
    setNewUrl(entry.url || '');
    setNewCategory(entry.category);
    setNewFolderId(entry.folderId || 'default');
    setShowPassword(false);
    setModalVisible(true);
  };

  const requestAuth = (title: string, action: () => void) => {
    setAuthTitle(title);
    setPendingAction(() => action);
    setAuthModalVisible(true);
  };

  const handleSave = async () => {
    if (!newTitle) return;
    if (!newUsername && !newPassword) {
      Alert.alert('Missing Details', 'Please provide either a username or a password.');
      return;
    }
    
    if (editingEntry) {
      // It's an update. We require authentication only if sensitive fields changed
      const sensitiveInfoChanged = (newUsername !== (editingEntry.username || '')) || (newPassword !== (editingEntry.password || ''));
      
      const executeUpdate = async () => {
        setIsSavingEntry(true);
        // Let UI update
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
          const updatedEntry: VaultEntry = {
            ...editingEntry,
            title: newTitle,
            username: newUsername,
            password: newPassword,
            url: newUrl,
            category: newCategory,
            folderId: newFolderId,
            updatedAt: Date.now(),
          };
          await updateEntry(updatedEntry);
          setModalVisible(false);
        } finally {
          setIsSavingEntry(false);
        }
      };

      if (sensitiveInfoChanged) {
        requestAuth('Authenticate to Update', executeUpdate);
      } else {
        executeUpdate();
      }
    } else {
      // New entry. No auth required to add.
      setIsSavingEntry(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        const entry: VaultEntry = {
          id: generateId(),
          title: newTitle,
          username: newUsername,
          password: newPassword,
          url: newUrl,
          category: newCategory,
          folderId: newFolderId,
          favorite: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await addEntry(entry);
        setModalVisible(false);
      } finally {
        setIsSavingEntry(false);
      }
    }
  };

  const handleDelete = () => {
    if (!editingEntry) return;
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This action is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            requestAuth('Authenticate to Delete', async () => {
              await deleteEntry(editingEntry.id);
              setModalVisible(false);
            });
          }
        }
      ]
    );
  };

  const handleEditFolderClick = async (folderId: string) => {
    if (editingEntry && editingEntry.folderId !== folderId) {
      await moveEntries([editingEntry.id], folderId);
      setNewFolderId(folderId);
      setEditingEntry({ ...editingEntry, folderId });
    } else {
      setNewFolderId(folderId);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedEntryIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEntryIds(newSet);
    if (newSet.size === 0) setSelectionMode(false);
  };

  const handleSelectAll = () => {
    if (selectedEntryIds.size === filteredEntries.length) {
      setSelectedEntryIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedEntryIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Selected Entries',
      `Are you sure you want to delete ${selectedEntryIds.size} entries? This action is irreversible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            requestAuth('Authenticate to Delete Selected', async () => {
              await deleteEntries(Array.from(selectedEntryIds));
              setSelectionMode(false);
              setSelectedEntryIds(new Set());
            });
          }
        }
      ]
    );
  };

  const handleBulkMove = async (folderId: string) => {
    await moveEntries(Array.from(selectedEntryIds), folderId);
    setMoveModalVisible(false);
    setSelectionMode(false);
    setSelectedEntryIds(new Set());
  };

  const hasChanges = !editingEntry || (
    newTitle !== editingEntry.title ||
    newUsername !== (editingEntry.username || '') ||
    newPassword !== (editingEntry.password || '') ||
    newUrl !== (editingEntry.url || '') ||
    newCategory !== editingEntry.category ||
    newFolderId !== editingEntry.folderId
  );
  const canSave = Boolean(newTitle && (newUsername || newPassword)) && hasChanges;

  const handleSaveFolder = async () => {
    if (!newFolderInputName) return;
    
    if (editingFolderId) {
      await updateFolder({
        id: editingFolderId,
        name: newFolderInputName,
        color: newFolderInputColor
      });
    } else {
      await addFolder({
        id: generateId(),
        name: newFolderInputName,
        color: newFolderInputColor
      });
    }
    
    setNewFolderModalVisible(false);
    setNewFolderInputName('');
    setEditingFolderId(null);
  };

  const handleDeleteFolder = () => {
    if (!editingFolderId || editingFolderId === 'default') return;

    const entriesInFolder = entries.filter(e => e.folderId === editingFolderId).length;
    
    if (entriesInFolder > 0) {
      Alert.alert(
        'Cannot Delete Folder',
        `This folder contains ${entriesInFolder} entries. Please transfer them to another folder before deleting this one.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Delete Folder',
      'Are you sure you want to delete this empty folder?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteFolder(editingFolderId);
            setNewFolderModalVisible(false);
            setEditingFolderId(null);
            if (folderFilter === editingFolderId) {
              setFolderFilter('All');
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#f4f4f5] dark:bg-[#09090b] pt-16">
      <View className="px-6 mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Image source={require('../../assets/images/logo.png')} className="w-10 h-10 rounded-xl" />
            <Text className="text-3xl font-bold text-zinc-900 dark:text-white">Nkrypt</Text>
          </View>
          <View className="flex-row gap-2">
          </View>
        </View>
        <View className="flex-row items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-sm">
          <Search color="#6B7280" size={20} />
          <TextInput
            className="flex-1 ml-3 text-zinc-900 dark:text-white text-base"
            placeholder="Search vault..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color="#9CA3AF" size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Folder Chips */}
      <View className="mb-4 pl-6">
        <FlatList 
          horizontal
          showsHorizontalScrollIndicator={false}
          data={folders}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <TouchableOpacity 
              onPress={() => setFolderFilter('All')}
              className={`px-4 py-2 rounded-full border mr-2 transition-colors ${folderFilter === 'All' ? 'bg-brand border-brand' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
            >
              <Text className={`font-semibold ${folderFilter === 'All' ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>All</Text>
            </TouchableOpacity>
          }
          renderItem={({ item: folder }) => (
            <TouchableOpacity 
              onLongPress={() => {
                setEditingFolderId(folder.id);
                setNewFolderInputName(folder.name);
                setNewFolderInputColor(folder.color);
                setNewFolderModalVisible(true);
              }}
              onPress={() => setFolderFilter(folder.id)}
              className={`px-4 py-2 rounded-full border mr-2 flex-row items-center gap-2 transition-colors ${folderFilter === folder.id ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
            >
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: folder.color }} />
              <Text className={`font-semibold ${folderFilter === folder.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>{folder.name}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity 
              onPress={() => {
                setEditingFolderId(null);
                setNewFolderInputName('');
                setNewFolderInputColor('#F5B971');
                setNewFolderModalVisible(true);
              }}
              className="px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mr-6 flex-row items-center gap-2"
            >
              <Plus color="#6B7280" size={16} />
              <Text className="font-semibold text-zinc-600 dark:text-zinc-400">New</Text>
            </TouchableOpacity>
          }
        />
      </View>

      <FlatList 
        data={filteredEntries}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16 }}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        renderItem={({ item }) => (
          <VaultItemCard 
            entry={item} 
            selected={selectedEntryIds.has(item.id)}
            onLongPress={() => {
              if (!selectionMode) {
                setSelectionMode(true);
                setSelectedEntryIds(new Set([item.id]));
              }
            }}
            onPress={() => {
              if (selectionMode) {
                toggleSelection(item.id);
              } else {
                handleOpenEdit(item);
              }
            }}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-zinc-500 text-lg">No entries found.</Text>
          </View>
        }
      />

      {/* Action Bar or FAB */}
      {selectionMode ? (
        <View className="absolute bottom-6 left-6 right-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex-row justify-between items-center shadow-lg">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedEntryIds(new Set()); }}>
              <X color="#6B7280" size={24} />
            </TouchableOpacity>
            <Text className="text-zinc-900 dark:text-white font-semibold text-lg">{selectedEntryIds.size} Selected</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={handleSelectAll} className="p-2">
              <CheckCheck color={selectedEntryIds.size === filteredEntries.length && filteredEntries.length > 0 ? "#10B981" : "#6B7280"} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMoveModalVisible(true)} className="p-2">
              <FolderInput color="#F5B971" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} className="p-2">
              <Trash2 color="#EF4444" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          className="absolute bottom-6 right-6 w-14 h-14 bg-brand rounded-full items-center justify-center shadow-lg shadow-brand/30"
          onPress={handleOpenAdd}
        >
          <Plus color="#FFF" size={28} />
        </TouchableOpacity>
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 bg-white dark:bg-[#09090b] pt-16">
          <View className="px-6 flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-zinc-900 dark:text-white">{editingEntry ? 'Edit Entry' : 'New Entry'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
              <X color="#6B7280" size={20} />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            className="flex-1 px-6"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-1 ml-1 font-medium">Title</Text>
              <TextInput 
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl mb-4" 
                placeholder="e.g. Google"
                placeholderTextColor="#9CA3AF"
                value={newTitle} onChangeText={setNewTitle}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-1 ml-1 font-medium">Username / Email</Text>
              <TextInput 
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl mb-4" 
                autoCapitalize="none"
                placeholder="john@example.com"
                placeholderTextColor="#9CA3AF"
                value={newUsername} onChangeText={setNewUsername}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
              />
            </View>
            <View>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-1 ml-1 font-medium">Password</Text>
              <View className="relative justify-center mb-4">
                <TextInput 
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl pr-12" 
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={newPassword} onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                />
                <TouchableOpacity 
                  className="absolute right-4"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff color="#9CA3AF" size={20} /> : <Eye color="#9CA3AF" size={20} />}
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-1 ml-1 font-medium">Website URL (Optional)</Text>
              <TextInput 
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl mb-6" 
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://example.com"
                placeholderTextColor="#9CA3AF"
                value={newUrl} onChangeText={setNewUrl}
              />
            </View>

            {/* Folder Picker */}
            <View>
              <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1 font-medium">Folder</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={folders}
                keyExtractor={item => item.id}
                renderItem={({ item: folder }) => (
                  <TouchableOpacity 
                    onPress={() => setNewFolderId(folder.id)}
                    className={`px-4 py-3 rounded-xl border mr-2 flex-row items-center gap-2 ${newFolderId === folder.id ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                  >
                    <View className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
                    <Text className={`font-semibold ${newFolderId === folder.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>{folder.name}</Text>
                  </TouchableOpacity>
                )}
                ListHeaderComponent={
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingFolderId(null);
                      setNewFolderInputName('');
                      setNewFolderInputColor('#F5B971');
                      setNewFolderModalVisible(true);
                    }}
                    className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mr-2 flex-row items-center gap-2"
                  >
                    <Plus color="#6B7280" size={16} />
                    <Text className="font-semibold text-zinc-600 dark:text-zinc-400">New</Text>
                  </TouchableOpacity>
                }
              />
            </View>
            
            <TouchableOpacity 
              className={`bg-brand p-4 rounded-xl items-center mt-6 flex-row justify-center mb-4 ${(!canSave || isSavingEntry) ? 'opacity-50' : ''}`}
              onPress={handleSave}
              disabled={!canSave || isSavingEntry}
            >
              {isSavingEntry ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white font-bold text-lg">{editingEntry ? 'Update Entry' : 'Save Entry'}</Text>
              )}
            </TouchableOpacity>

            {editingEntry && (
              <TouchableOpacity 
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-4 rounded-xl items-center mb-12"
                onPress={handleDelete}
              >
                <Text className="text-red-600 dark:text-red-500 font-bold text-lg">Delete Entry</Text>
              </TouchableOpacity>
            )}
            <View className="h-8" />
          </ScrollView>
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
            // Need a slight delay so the modals don't clash on iOS
            setTimeout(() => {
              pendingAction();
              setPendingAction(null);
            }, 300);
          }
        }}
      />

      {/* Folder Add/Edit Modal */}
      <Modal visible={newFolderModalVisible} animationType="fade" transparent onRequestClose={() => setNewFolderModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-1 bg-black/60 justify-center p-6">
            <View className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-6">{editingFolderId ? 'Edit Folder' : 'Create New Folder'}</Text>
            
            <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1 font-medium">Folder Name</Text>
            <TextInput
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white p-4 rounded-xl mb-6"
              placeholder="e.g. Work"
              placeholderTextColor="#9CA3AF"
              value={newFolderInputName}
              onChangeText={setNewFolderInputName}
              autoCapitalize="words"
              autoFocus
            />

            <Text className="text-zinc-500 dark:text-zinc-400 mb-2 ml-1 font-medium">Folder Color</Text>
            <View className="flex-row flex-wrap gap-3 mb-8">
              {FOLDER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewFolderInputColor(color)}
                  className={`w-10 h-10 rounded-full items-center justify-center ${newFolderInputColor === color ? 'border-2 border-zinc-900 dark:border-white' : ''}`}
                >
                  <View className="w-8 h-8 rounded-full" style={{ backgroundColor: color }} />
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl items-center"
                onPress={() => setNewFolderModalVisible(false)}
              >
                <Text className="text-zinc-900 dark:text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className={`flex-1 bg-brand p-4 rounded-xl items-center ${!newFolderInputName.trim() ? 'opacity-50' : ''}`}
                onPress={handleSaveFolder}
                disabled={!newFolderInputName.trim()}
              >
                <Text className="text-white font-bold">{editingFolderId ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
              </View>

            {editingFolderId && editingFolderId !== 'default' && (
              <TouchableOpacity 
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-4 rounded-xl items-center mt-6"
                onPress={handleDeleteFolder}
              >
                <Text className="text-red-600 dark:text-red-500 font-bold text-lg">Delete Folder</Text>
              </TouchableOpacity>
            )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Move Entries Modal */}
      <Modal visible={moveModalVisible} animationType="slide" transparent onRequestClose={() => setMoveModalVisible(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white dark:bg-zinc-900 rounded-t-3xl p-6 border-t border-zinc-200 dark:border-zinc-800">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white">Move {selectedEntryIds.size} Items</Text>
              <TouchableOpacity onPress={() => setMoveModalVisible(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                <X color="#6B7280" size={20} />
              </TouchableOpacity>
            </View>
            
            <ScrollView className="max-h-96">
              {folders.map(folder => (
                <TouchableOpacity
                  key={folder.id}
                  onPress={() => {
                    requestAuth('Authenticate to Move', () => handleBulkMove(folder.id));
                  }}
                  className="flex-row items-center p-4 border-b border-zinc-100 dark:border-zinc-800"
                >
                  <View className="w-4 h-4 rounded-full mr-4" style={{ backgroundColor: folder.color }} />
                  <Text className="text-zinc-900 dark:text-white text-lg">{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
