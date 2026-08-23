import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
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
  const [newFolderInputColor, setNewFolderInputColor] = useState('#3B82F6');
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  const FOLDER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

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

  return (
    <View className="flex-1 bg-zinc-950 p-4">
      {/* Search Bar */}
      <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4">
        <Search color="#9CA3AF" size={20} />
        <TextInput 
          className="flex-1 text-white ml-2 text-base"
          placeholder="Search vault..."
          placeholderTextColor="#6B7280"
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

      {/* Folder Chips */}
      <View className="mb-4">
        <FlatList 
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'All', name: 'All', color: '#9CA3AF' } as VaultFolder, ...folders]}
          keyExtractor={item => item.id}
          renderItem={({ item: folder }) => (
            <TouchableOpacity 
              onPress={() => setFolderFilter(folder.id)}
              onLongPress={() => {
                if (folder.id !== 'All' && folder.id !== 'default') {
                  Alert.alert(
                    `${folder.name}`,
                    `What would you like to do with this folder?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Edit Folder',
                        onPress: () => {
                          setEditingFolderId(folder.id);
                          setNewFolderInputName(folder.name);
                          setNewFolderInputColor(folder.color);
                          setNewFolderModalVisible(true);
                        }
                      },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: () => {
                          const hasEntries = entries.some(e => e.folderId === folder.id);
                          if (hasEntries) {
                            Alert.alert('Cannot Delete', 'This folder is not empty. Please move or delete the passwords inside it first.');
                            return;
                          }

                          requestAuth('Authenticate to Delete', async () => {
                            await deleteFolder(folder.id);
                            if (folderFilter === folder.id) setFolderFilter('All');
                          });
                        }
                      }
                    ]
                  );
                }
              }}
              className={`px-4 py-2 rounded-full border mr-2 flex-row items-center space-x-2 gap-2 ${folderFilter === folder.id ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-900 border-zinc-800'}`}
            >
              {folder.id !== 'All' && (
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
              )}
              <Text className={`font-semibold ${folderFilter === folder.id ? 'text-white' : 'text-zinc-400'}`}>{folder.name}</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <TouchableOpacity 
              onPress={() => {
                setEditingFolderId(null);
                setNewFolderInputName('');
                setNewFolderInputColor('#3B82F6');
                setNewFolderModalVisible(true);
              }}
              className="px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900 mr-2 flex-row items-center space-x-2 gap-2"
            >
              <Plus color="#9CA3AF" size={16} />
              <Text className="font-semibold text-zinc-400">New</Text>
            </TouchableOpacity>
          }
        />
      </View>

      <FlatList 
        data={filteredEntries}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
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
        <View className="absolute bottom-6 left-6 right-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-row justify-between items-center shadow-lg shadow-black/50">
          <View className="flex-row items-center space-x-3 gap-3">
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedEntryIds(new Set()); }}>
              <X color="#9CA3AF" size={24} />
            </TouchableOpacity>
            <Text className="text-white font-semibold text-lg">{selectedEntryIds.size} Selected</Text>
          </View>
          <View className="flex-row items-center space-x-4 gap-4">
            <TouchableOpacity onPress={handleSelectAll} className="p-2">
              <CheckCheck color={selectedEntryIds.size === filteredEntries.length && filteredEntries.length > 0 ? "#10B981" : "#9CA3AF"} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMoveModalVisible(true)} className="p-2">
              <FolderInput color="#3B82F6" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} className="p-2">
              <Trash2 color="#EF4444" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg shadow-blue-500/30"
          onPress={handleOpenAdd}
        >
          <Plus color="#FFF" size={28} />
        </TouchableOpacity>
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet">
        <View className="flex-1 bg-black/90 pt-16">
          <View className="px-6 flex-row justify-between items-center mb-6">
            <Text className="text-3xl font-bold text-white">{editingEntry ? 'Edit Entry' : 'New Entry'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X color="#FFF" size={28} />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            className="flex-1 px-6"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="text-zinc-400 mb-1 ml-1">Title</Text>
              <TextInput 
                className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl" 
                placeholder="e.g. Google"
                placeholderTextColor="#52525B"
                value={newTitle} onChangeText={setNewTitle}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text className="text-zinc-400 mb-1 ml-1">Username / Email</Text>
              <TextInput 
                className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl" 
                autoCapitalize="none"
                placeholder="john@example.com"
                placeholderTextColor="#52525B"
                value={newUsername} onChangeText={setNewUsername}
                autoCapitalize="none"
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
              />
            </View>
            <View>
              <Text className="text-zinc-400 mb-1 ml-1">Password</Text>
              <View className="relative justify-center">
                <TextInput 
                  className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl pr-12" 
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#52525B"
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

            <Text className="text-zinc-500 uppercase text-xs font-bold tracking-wider mt-8 mb-4 ml-1">Additional Info</Text>

            <View>
              <Text className="text-zinc-400 mb-1 ml-1">Website URL (Optional)</Text>
              <TextInput 
                className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl mb-4" 
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://example.com"
                placeholderTextColor="#52525B"
                value={newUrl} onChangeText={setNewUrl}
              />
            </View>

            {/* Folder Picker */}
            <View>
              <Text className="text-zinc-400 mb-2 ml-1">Folder</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={folders}
                keyExtractor={item => item.id}
                renderItem={({ item: folder }) => (
                  <TouchableOpacity 
                    onPress={() => handleEditFolderClick(folder.id)}
                    className={`px-4 py-3 rounded-xl border mr-2 flex-row items-center space-x-2 gap-2 ${newFolderId === folder.id ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-900 border-zinc-800'}`}
                  >
                    <View className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
                    <Text className={`font-semibold ${newFolderId === folder.id ? 'text-white' : 'text-zinc-400'}`}>{folder.name}</Text>
                  </TouchableOpacity>
                )}
                ListHeaderComponent={
                  <TouchableOpacity 
                    onPress={() => {
                      setEditingFolderId(null);
                      setNewFolderInputName('');
                      setNewFolderInputColor('#3B82F6');
                      setNewFolderModalVisible(true);
                    }}
                    className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 mr-2 flex-row items-center space-x-2 gap-2"
                  >
                    <Plus color="#9CA3AF" size={16} />
                    <Text className="font-semibold text-zinc-400">New</Text>
                  </TouchableOpacity>
                }
              />
            </View>
            
            <TouchableOpacity 
              className={`bg-blue-500 p-4 rounded-xl items-center mt-4 flex-row justify-center ${(!canSave || isSavingEntry) ? 'opacity-50' : ''}`}
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
                className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl items-center mt-2"
                onPress={handleDelete}
              >
                <Text className="text-red-500 font-bold text-lg">Delete Entry</Text>
              </TouchableOpacity>
            )}
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
      <Modal visible={newFolderModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-700">
            <Text className="text-xl font-bold text-white mb-6">{editingFolderId ? 'Edit Folder' : 'Create New Folder'}</Text>
            
            <Text className="text-zinc-400 mb-2 ml-1">Folder Name</Text>
            <TextInput
              className="bg-zinc-950 border border-zinc-800 text-white p-4 rounded-xl mb-6"
              placeholder="e.g. Work"
              placeholderTextColor="#52525B"
              value={newFolderInputName}
              onChangeText={setNewFolderInputName}
              autoCapitalize="none"
            />

            <Text className="text-zinc-400 mb-2 ml-1">Folder Color</Text>
            <View className="flex-row flex-wrap gap-3 mb-8">
              {FOLDER_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewFolderInputColor(color)}
                  className={`w-10 h-10 rounded-full border-2 ${newFolderInputColor === color ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </View>
            
            <View className="flex-row gap-4 space-x-4">
              <TouchableOpacity 
                className="flex-1 bg-zinc-800 p-4 rounded-xl items-center"
                onPress={() => {
                  setNewFolderModalVisible(false);
                  setEditingFolderId(null);
                }}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 bg-blue-600 p-4 rounded-xl items-center ${!newFolderInputName ? 'opacity-50' : ''}`}
                onPress={handleSaveFolder}
                disabled={!newFolderInputName}
              >
                <Text className="text-white font-semibold">{editingFolderId ? 'Save Changes' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Bulk Move Modal */}
      <Modal visible={moveModalVisible} transparent animationType="fade">
        <TouchableOpacity className="flex-1 bg-black/80 justify-end" onPress={() => setMoveModalVisible(false)} activeOpacity={1}>
          <View className="bg-zinc-900 rounded-t-3xl border-t border-zinc-700 p-6 pb-12 max-h-[80%]">
            <Text className="text-xl font-bold text-white mb-6">Move {selectedEntryIds.size} Items To...</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {folders.map(folder => (
                <TouchableOpacity 
                  key={folder.id} 
                  className="flex-row items-center p-4 border-b border-zinc-800"
                  onPress={() => handleBulkMove(folder.id)}
                >
                  <View className="w-4 h-4 rounded-full mr-4" style={{ backgroundColor: folder.color }} />
                  <Text className="text-white font-semibold text-lg">{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
