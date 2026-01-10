# Testing on Physical Devices

This guide explains how to test the Cumprido mobile app on your physical iPhone or Android device.

## Prerequisites

1. **Same WiFi Network**: Your computer and phone must be on the same WiFi network
2. **Backend Server Running**: Make sure your backend server is running on port 3001
3. **Expo Go App** (for quick testing) OR **Development Build** (for full features)

## Step 1: Find Your Computer's IP Address

### Mac/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
2. **API Reachable**: By default the app uses the production API at `https://api.cumprido.com`.
   - If you want to test against a local backend on your machine, it must be reachable from your phone (same WiFi, firewall open, server listening on `0.0.0.0`).
ipconfig getifaddr en0
```

### Windows:
The app is configured to use the production API by default.

To override the API base URL for local testing, set an Expo public env var before starting Expo:

- `EXPO_PUBLIC_API_URL=http://YOUR_IP:3001` (preferred)
- or `EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3001` (fallback)

Example:
```bash
export EXPO_PUBLIC_API_URL=http://192.168.1.210:3001
```
ipconfig
# Look for "IPv4 Address" under your active network adapter
```
If you're using a local backend, make sure it's running and accessible:
You should see something like `192.168.1.210` or `10.0.0.5`

## Step 2: Update API Configuration

The app is already configured to use `192.168.1.210` for physical devices. If your IP is different:

1. Open `apps/mobile/app/lib/api.ts`
1. **Check API Base**: Ensure `EXPO_PUBLIC_API_URL` (if set) matches your computer's IP
3. Update the return value with your computer's IP:
   ```typescript
   return __DEV__ ? "YOUR_IP_HERE" : null;
   ```

## Step 3: Start the Backend Server


**Production API**: `https://api.cumprido.com`

**Local Backend URL Example**: `http://192.168.1.210:3001` (set via `EXPO_PUBLIC_API_URL`)
```bash
cd cumprido/apps/server
npm run start:dev
To switch back to simulator/emulator testing:
1. Unset `EXPO_PUBLIC_API_URL` (if you set it)
2. Restart the Expo server
**Important**: Make sure your firewall allows connections on port 3001!

1. (Optional) Set `EXPO_PUBLIC_API_URL` to your local backend base URL
2. Restart the Expo server
- Allow incoming connections for Node.js

### Windows Firewall:
- Windows Defender Firewall → Allow an app
- Add Node.js or allow port 3001

## Step 4: Start Expo Development Server

```bash
cd cumprido/apps/mobile
npm start
# or
npx expo start
```

You'll see a QR code and options in the terminal.

## Step 5: Connect Your Device

### Option A: Using Expo Go (Quick Testing)

**iOS:**
1. Install "Expo Go" from the App Store
2. Open Expo Go app
3. Scan the QR code from the terminal (Camera app on iOS 13+)
4. Or press `i` in the terminal to open on iOS

**Android:**
1. Install "Expo Go" from Google Play Store
2. Open Expo Go app
3. Scan the QR code from the terminal
4. Or press `a` in the terminal to open on Android

**⚠️ Important Limitations of Expo Go:**

Expo Go has limited support for custom native modules. You may see errors like:
- `'OnrampSdk' could not be found` (Stripe)
- `'RNMapsAirModule' could not be found` (Maps)

**These are expected in Expo Go** - the app will still work, but:
- ❌ Payment features (Stripe) won't work
- ❌ Maps won't work
- ✅ Chat, messaging, and most other features will work fine

**For full testing with all features, you MUST use a development build** (see Option B below).

### Option B: Development Build (Recommended for Full Features)

**For iOS:**
```bash
# Build and install on connected iPhone
npx expo run:ios --device

# Or build first, then install via Xcode
npx expo prebuild
cd ios
xcodebuild -workspace Cumprido.xcworkspace -scheme Cumprido -configuration Debug
```

**For Android:**
```bash
# Build and install on connected Android device
npx expo run:android --device

# Make sure USB debugging is enabled on your Android device
# Settings → Developer Options → USB Debugging
```

## Step 6: Verify Connection

1. Open the app on your device
2. Check the terminal/console for any connection errors
3. Try logging in - if it works, the connection is successful!

## Troubleshooting

### Errors about missing native modules (Stripe, Maps)

**If you see errors like:**
```
ERROR [Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'OnrampSdk' could not be found]
ERROR [Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found]
```

**This is normal in Expo Go!** These errors occur because:
- Stripe requires custom native code not included in Expo Go
- Maps requires custom native code not included in Expo Go

**Solutions:**
1. **Ignore them** - The app will still work for most features (chat, navigation, etc.)
2. **Use a Development Build** - This is the recommended solution for full testing:
   ```bash
   # iOS
   npx expo run:ios --device
   
   # Android
   npx expo run:android --device
   ```

### "Network request failed" or "Cannot connect to server"

1. **Check IP Address**: Make sure the IP in `api.ts` matches your computer's IP
2. **Check WiFi**: Ensure both devices are on the same network
3. **Check Firewall**: Make sure port 3001 is not blocked
4. **Check Backend**: Verify the server is running: `curl http://localhost:3001/health`
5. **Test from Device**: Open `http://YOUR_IP:3001/health` in your phone's browser

### "Expo Go can't load the app" or ThemeProvider errors

**If you see:**
```
ERROR [Error: useTheme must be used within a ThemeProvider]
```

This usually means the app is loading before providers are ready. Try:
1. **Clear Expo Go cache**: Settings → Clear Cache
2. **Restart the Expo server**: Stop (`Ctrl+C`) and run `npm start` again
3. **Reload the app**: Shake device → Reload, or press `r` in the terminal

If the error persists, use a development build instead of Expo Go.

### Backend not accessible from device

Test if your backend is accessible:
```bash
# From your phone's browser, try:
http://192.168.1.210:3001/health
```

If this doesn't work, check:
- Firewall settings
- Backend is binding to `0.0.0.0` not just `localhost`
- Router settings (some routers block device-to-device communication)

## Quick Reference

**Your Computer's IP**: `192.168.1.210` (update in `app/lib/api.ts` if different)

**Backend URL**: `http://192.168.1.210:3001`

**Expo Commands**:
- `npm start` - Start development server (for Expo Go)
- `npx expo run:ios --device` - Build and run on iOS device (development build)
- `npx expo run:android --device` - Build and run on Android device (development build)

## Recommendation: Use Development Build

For the best testing experience with all features working:

**iOS:**
```bash
cd cumprido/apps/mobile
npx expo run:ios --device
```

**Android:**
```bash
cd cumprido/apps/mobile
npx expo run:android --device
```

This will:
- ✅ Install the app directly on your device
- ✅ Include all native modules (Stripe, Maps, etc.)
- ✅ Work exactly like a production app
- ✅ Allow hot reloading during development

## Switching Between Simulator and Physical Device

To switch back to simulator/emulator testing:
1. Set `getLocalIP()` to return `null` in `app/lib/api.ts`
2. Restart the Expo server

To use physical device:
1. Set `getLocalIP()` to return your IP (e.g., `"192.168.1.210"`)
2. Restart the Expo server

