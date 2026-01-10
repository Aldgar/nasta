# i18n Implementation Plan

## Status: IN PROGRESS

## Completed Files ✅
1. `app/(tabs)/_layout.tsx` - Navigation tabs
2. `app/employer-tabs/_layout.tsx` - Employer navigation tabs  
3. `app/index.tsx` - Landing page
4. `app/login.tsx` - Login screen
5. `app/register.tsx` - Registration screen
6. `app/settings.tsx` - Settings screen
7. `app/kyc-start.tsx` - KYC start screen
8. `app/employer-home.tsx` - Employer home
9. `app/user-home.tsx` - User home

## Remaining Files (51 files) 🔄
All other files in `app/` directory need translation:
- Feed, jobs, applications screens
- Chat screens
- Payment screens
- Admin screens
- Onboarding
- Legal screens
- Support/Report screens
- And more...

## Translation File Structure
- `locales/en.json` - English (source of truth)
- `locales/pt.json` - Portuguese translations

## Implementation Pattern
For each file:
1. Import: `import { useLanguage } from "../context/LanguageContext";`
2. Use hook: `const { t } = useLanguage();`
3. Replace strings: `"Hardcoded Text"` → `{t("key.path")}`
4. Add keys to both `en.json` and `pt.json`

## Next Steps
Continue systematically through remaining files, adding translation keys as needed.


