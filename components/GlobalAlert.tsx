import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useAlertStore } from '../store/useAlertStore';

export function GlobalAlert() {
  const { visible, title, message, buttons, hide } = useAlertStore();

  if (!visible) return null;

  const handlePress = (onPress?: () => void) => {
    hide();
    if (onPress) {
      // Small delay to allow the modal to hide smoothly before executing the action,
      // especially if the action opens another modal.
      setTimeout(onPress, 50);
    }
  };

  const isVertical = buttons.length > 2;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View className="flex-1 bg-black/60 justify-center items-center p-6">
        <View className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
          {/* Content Area */}
          <View className="p-6 items-center">
            <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2 text-center">{title}</Text>
            {!!message && (
              <Text className="text-zinc-500 dark:text-zinc-400 text-center leading-5">{message}</Text>
            )}
          </View>

          {/* Buttons Area */}
          <View className={`border-t border-zinc-200 dark:border-zinc-800 ${isVertical ? 'flex-col' : 'flex-row'}`}>
            {buttons.map((btn, index) => {
              const isLast = index === buttons.length - 1;
              const borderClasses = isVertical
                ? (isLast ? '' : 'border-b border-zinc-200 dark:border-zinc-800')
                : (isLast ? '' : 'border-r border-zinc-200 dark:border-zinc-800');

              let textColorClass = 'text-brand dark:text-brand';
              if (btn.style === 'destructive') textColorClass = 'text-red-600 dark:text-red-500 font-bold';
              else if (btn.style === 'cancel') textColorClass = 'text-zinc-900 dark:text-white font-semibold';
              else if (btn.style === 'default' || !btn.style) textColorClass = 'text-brand dark:text-brand font-semibold';

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePress(btn.onPress)}
                  className={`${isVertical ? 'w-full' : 'flex-1'} p-4 items-center justify-center ${borderClasses} active:bg-zinc-100 dark:active:bg-zinc-800`}
                >
                  <Text className={`text-lg ${textColorClass}`}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
