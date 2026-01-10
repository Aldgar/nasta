# Translation Status

## ✅ Fully Translated Screens
1. **Settings** (`app/settings.tsx`) - Complete
2. **Login** (`app/login.tsx`) - Complete  
3. **KYC Start** (`app/kyc-start.tsx`) - Complete
4. **Employer Home** (`app/employer-home.tsx`) - Complete

## 🔄 Partially Translated
- Some screens have translations but not all strings

## ❌ Not Yet Translated
- Most other screens still need translation

## Important Notes

### After Changing Language:
1. **Reload the app** - The app needs to reload to see all translations
2. In development: Shake device → "Reload" or press `r` in Metro bundler
3. The language preference is saved and will persist across app restarts

### How to Translate More Screens:
1. Import `useLanguage` hook
2. Replace hardcoded strings with `t("key.path")`
3. Add keys to both `locales/en.json` and `locales/pt.json`

See `TRANSLATION_GUIDE.md` for detailed instructions.


