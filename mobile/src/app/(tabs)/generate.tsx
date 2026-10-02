import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/config/theme';
import type { GenerationMode } from '@/types/generation';

const modes: { id: GenerationMode; title: string; description: string }[] = [
  { id: 'video', title: 'Text to video', description: 'Describe a scene and set it in motion.' },
  { id: 'image', title: 'Image', description: 'Create a visual from a written prompt.' },
  { id: 'text', title: 'Text', description: 'Draft, rewrite, and refine your words.' },
  { id: 'audio', title: 'Audio', description: 'Shape a voice, sound, or atmosphere.' },
  { id: 'chat', title: 'Creative chat', description: 'Develop an idea with Agnes.' },
];

export default function GenerateScreen() {
  const [mode, setMode] = useState<GenerationMode>('video');
  const [prompt, setPrompt] = useState('');

  function startGeneration() {
    Alert.alert('Account connection needed', 'Native sign-in and generation are not connected yet.');
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>NEW CREATION</Text>
      <Text style={styles.title}>What are we{ '\n' }making today?</Text>
      <Text style={styles.subtitle}>Choose a mode, then give your idea a first shape.</Text>

      <Text style={styles.sectionLabel}>GENERATION MODE</Text>
      <View style={styles.modeGrid}>
        {modes.map((item, index) => {
          const selected = mode === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMode(item.id)}
              style={[styles.modeCard, selected && styles.modeCardSelected]}
            >
              <Text style={[styles.modeIndex, selected && styles.modeIndexSelected]}>0{index + 1}</Text>
              <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{item.title}</Text>
              <Text style={[styles.modeDescription, selected && styles.modeDescriptionSelected]}>{item.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>YOUR PROMPT</Text>
      <TextInput
        accessibilityLabel="Describe your idea"
        multiline
        maxLength={1200}
        onChangeText={setPrompt}
        placeholder="A lone cyclist rides through a rain-lit city at midnight..."
        placeholderTextColor="#92948C"
        style={styles.promptInput}
        textAlignVertical="top"
        value={prompt}
      />
      <View style={styles.promptMeta}>
        <Text style={styles.promptHint}>Be specific about light, camera, and mood.</Text>
        <Text style={styles.promptCount}>{prompt.length}/1200</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!prompt.trim()}
        onPress={startGeneration}
        style={[styles.submitButton, !prompt.trim() && styles.submitButtonDisabled]}
      >
        <Text style={styles.submitText}>Create with {mode === 'video' ? 'video' : mode}</Text>
        <Text style={styles.submitArrow}>↗</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { paddingHorizontal: 22, paddingTop: 38, paddingBottom: 40 },
  eyebrow: { color: palette.coral, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 9 },
  title: { color: palette.ink, fontSize: 32, fontWeight: '800', lineHeight: 36 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 27 },
  sectionLabel: { color: palette.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 25 },
  modeCard: { width: '48%', minHeight: 115, borderRadius: 6, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FBFAF6', padding: 12 },
  modeCardSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  modeIndex: { color: palette.coral, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  modeIndexSelected: { color: palette.lime },
  modeTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 10 },
  modeTitleSelected: { color: palette.paper },
  modeDescription: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  modeDescriptionSelected: { color: '#C5C6C0' },
  promptInput: { minHeight: 128, borderWidth: 1, borderColor: palette.line, borderRadius: 6, backgroundColor: '#FBFAF6', color: palette.ink, fontSize: 14, lineHeight: 21, padding: 14 },
  promptMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20 },
  promptHint: { color: palette.muted, fontSize: 10 },
  promptCount: { color: palette.muted, fontSize: 10 },
  submitButton: { minHeight: 48, borderRadius: 5, backgroundColor: palette.lime, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submitButtonDisabled: { opacity: 0.45 },
  submitText: { color: palette.ink, fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  submitArrow: { color: palette.ink, fontSize: 20 },
});