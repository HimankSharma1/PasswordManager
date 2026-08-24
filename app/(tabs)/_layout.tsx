import React from 'react';
import { Tabs } from 'expo-router';
import { Shield, Key, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { 
        backgroundColor: isDark ? '#09090b' : '#ffffff', 
        borderTopWidth: 1, 
        borderTopColor: isDark ? '#27272a' : '#e4e4e7', 
        paddingBottom: 5 
      },
      tabBarActiveTintColor: '#F5B971',
      tabBarInactiveTintColor: isDark ? '#52525B' : '#a1a1aa',
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Vault',
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />
        }} 
      />
      <Tabs.Screen 
        name="generator" 
        options={{ 
          title: 'Generator',
          tabBarIcon: ({ color, size }) => <Key color={color} size={size} />
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />
        }} 
      />
    </Tabs>
  );
}
