import { Redirect, useLocalSearchParams } from "expo-router";

// Гүн холбоос: alkhaach.mn/j/KZ7M4Q → кодоор нэгдэх дэлгэц
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: "/join", params: { code: code || "" } }} />;
}
