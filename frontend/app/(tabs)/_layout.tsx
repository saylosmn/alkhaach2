import React from "react";
import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopWidth: 1.5,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemi,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Нүүр",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="home" size={22} color={color} style={{ opacity: focused ? 1 : 0.7 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Тэмдэглэл",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="bar-chart-2" size={22} color={color} style={{ opacity: focused ? 1 : 0.7 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Бүлэг",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="users" size={22} color={color} style={{ opacity: focused ? 1 : 0.7 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Би",
          tabBarIcon: ({ color, focused }) => (
            <Feather name="user" size={22} color={color} style={{ opacity: focused ? 1 : 0.7 }} />
          ),
        }}
      />
    </Tabs>
  );
}
