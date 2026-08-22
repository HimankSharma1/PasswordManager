import React from 'react';
import { Tabs } from 'expo-router';
import { Shield, Key, Settings } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: true, 
      headerStyle: { backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#27272a' },
      headerTintColor: '#fff',
      tabBarStyle: { backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#27272a', paddingBottom: 5 },
      tabBarActiveTintColor: '#3B82F6',
      tabBarInactiveTintColor: '#52525B',
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
