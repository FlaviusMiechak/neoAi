# Normalizer AI Mobile

Expo Router app for the Android client. Its feature boundaries mirror the web app while using React Native screens and platform navigation.

## Run

```bash
bun install
bun run android
```

Start with `bun run start` to open the Expo development menu, then select an Android emulator or scan the QR code with Expo Go.

## Structure

- `app/`: Expo Router screens for projects, generation, and the library
- `components/`: reusable native UI
- `config/`: app-wide design tokens and configuration
- `lib/`: API and domain services
- `store/`: shared client state
- `types/`: project and generation models

The web app's API currently authenticates with an HTTP-only cookie. `lib/api.ts` describes the bearer-token contract the native client expects, but the existing API does not accept that contract yet. Add a secure token-based session flow on the server before wiring private projects and generation endpoints; do not put Supabase admin credentials in this app. The Generate screen currently shows the expected connection state rather than submitting a request.