import { useEffect, useState } from "react";
import { Button, SafeAreaView, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  if (session) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, marginBottom: 16 }}>
          signed in as {session.user.email}
        </Text>
        <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "600" }}>Rintakez (mobile proof)</Text>
        <TextInput
          placeholder="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8 }}
        />
        <TextInput
          placeholder="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8 }}
        />
        <Button title="Sign in" onPress={signIn} />
        {error ? <Text style={{ color: "crimson" }}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
