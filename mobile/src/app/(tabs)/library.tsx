import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/config/theme';

export default function LibraryScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOUR OUTPUTS</Text>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>Generations from all of your projects, in one place.</Text>

      <View style={styles.filters}>
        <Text style={styles.filterActive}>All</Text>
        <Text style={styles.filter}>Video</Text>
        <Text style={styles.filter}>Image</Text>
        <Text style={styles.filter}>Audio</Text>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.emptyArtwork}>
          <View style={styles.artworkDisc} />
          <View style={styles.artworkLine} />
        </View>
        <Text style={styles.emptyTitle}>Nothing rendered yet</Text>
        <Text style={styles.emptyCopy}>When you create something, it will be ready to revisit here.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { paddingHorizontal: 22, paddingTop: 38, paddingBottom: 32 },
  eyebrow: { color: palette.coral, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 9 },
  title: { color: palette.ink, fontSize: 34, fontWeight: '800', lineHeight: 39 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  filters: { flexDirection: 'row', gap: 7, borderBottomWidth: 1, borderColor: palette.line, paddingBottom: 12 },
  filterActive: { color: palette.ink, backgroundColor: palette.lime, fontSize: 11, fontWeight: '800', overflow: 'hidden', borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6 },
  filter: { color: palette.muted, fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingTop: 58, paddingHorizontal: 25 },
  emptyArtwork: { width: 102, height: 102, borderRadius: 51, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  artworkDisc: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: palette.lime },
  artworkLine: { width: 22, height: 1, backgroundColor: palette.coral, position: 'absolute', right: 10, top: 30, transform: [{ rotate: '40deg' }] },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '800', marginTop: 20 },
  emptyCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, maxWidth: 260 },
});