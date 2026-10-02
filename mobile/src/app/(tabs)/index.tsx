import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/config/theme';

export default function ProjectsScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topline}>
        <Text style={styles.wordmark}>NORMALIZER<Text style={styles.wordmarkAccent}>AI</Text></Text>
        <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
      </View>

      <Text style={styles.eyebrow}>YOUR WORKSPACE</Text>
      <Text style={styles.title}>Projects</Text>
      <Text style={styles.subtitle}>Keep every idea, render, and revision together.</Text>

      <View style={styles.feature}>
        <View style={styles.featureTopline}>
          <Text style={styles.featureLabel}>CREATIVE STUDIO</Text>
          <Text style={styles.featureMark}>01 / 03</Text>
        </View>
        <Text style={styles.featureTitle}>Make the next{ '\n' }thing feel real.</Text>
        <Text style={styles.featureCopy}>Build a project, then turn a prompt into a moving image.</Text>
        <Link href="/(tabs)/generate" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start creating</Text>
            <Text style={styles.buttonArrow}>↗</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Recent projects</Text>
        <Text style={styles.count}>0</Text>
      </View>
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>+</Text></View>
        <Text style={styles.emptyTitle}>A clean slate</Text>
        <Text style={styles.emptyCopy}>Your projects will appear here once native sign-in is connected.</Text>
      </View>
      <Text style={styles.footer}>NORMALIZER AI  ·  MOBILE STUDIO</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 28 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  wordmark: { color: palette.ink, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  wordmarkAccent: { color: palette.coral },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.paper, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: palette.coral, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  title: { color: palette.ink, fontSize: 34, fontWeight: '800', letterSpacing: 0, lineHeight: 39 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  feature: { backgroundColor: palette.ink, borderRadius: 8, padding: 20, overflow: 'hidden' },
  featureTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureLabel: { color: palette.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  featureMark: { color: '#A5A7A0', fontSize: 10, fontWeight: '600' },
  featureTitle: { color: '#F9F8F3', fontSize: 28, fontWeight: '800', lineHeight: 32, marginTop: 26 },
  featureCopy: { color: '#C5C6C0', fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: 250 },
  primaryButton: { backgroundColor: palette.lime, minHeight: 46, borderRadius: 5, marginTop: 22, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryButtonText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  buttonArrow: { color: palette.ink, fontSize: 20, fontWeight: '500' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  count: { color: palette.muted, fontSize: 12, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: palette.line, borderStyle: 'dashed', borderRadius: 8 },
  emptyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: palette.ink, fontSize: 22, fontWeight: '500' },
  emptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 12 },
  emptyCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 250 },
  footer: { color: '#A2A39B', fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginTop: 26, textAlign: 'center' },
});
