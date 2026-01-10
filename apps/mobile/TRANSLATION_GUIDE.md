# Translation Guide

## Overview
This app uses i18next for internationalization. No environment variables are needed - language detection is automatic based on device settings.

## Step-by-Step: Translating a Screen

### Step 1: Import the useLanguage hook
At the top of your component file, add:
```typescript
import { useLanguage } from "../context/LanguageContext";
```

### Step 2: Use the hook in your component
Inside your component function, add:
```typescript
const { t } = useLanguage();
```

### Step 3: Replace hardcoded strings
Replace hardcoded text with translation keys:
```typescript
// Before:
<Text>Login</Text>

// After:
<Text>{t("auth.login")}</Text>
```

### Step 4: Add missing keys to translation files
If a key doesn't exist, add it to both:
- `/locales/en.json` (English)
- `/locales/pt.json` (Portuguese)

Example:
```json
{
  "auth": {
    "login": "Login",
    "signIn": "Sign In"
  }
}
```

## Translation File Structure

Keys are organized by feature/screen:
- `common.*` - Common buttons/actions (Save, Cancel, etc.)
- `auth.*` - Authentication screens
- `settings.*` - Settings screen
- `profile.*` - Profile/user info
- `jobs.*` - Job-related screens
- `kyc.*` - KYC verification
- `legal.*` - Legal pages
- `notifications.*` - Notifications
- `chat.*` - Chat/messaging

## Examples

### Simple text replacement
```typescript
// Before
<Text>Settings</Text>

// After
<Text>{t("settings.title")}</Text>
```

### With variables/interpolation
```typescript
// In translation file:
{
  "welcome": "Welcome, {{name}}!"
}

// In component:
<Text>{t("welcome", { name: user.name })}</Text>
```

### Placeholder text
```typescript
// Before
<TextInput placeholder="Enter email" />

// After
<TextInput placeholder={t("auth.emailPlaceholder")} />
```

### Alert messages
```typescript
// Before
Alert.alert("Error", "Something went wrong");

// After
Alert.alert(t("common.error"), t("common.errorMessage"));
```

## Best Practices

1. **Use descriptive key names**: `auth.login` is better than `login`
2. **Group related keys**: Keep all auth-related keys under `auth.*`
3. **Keep keys consistent**: Use the same key structure across similar features
4. **Add keys to both files**: Always update `en.json` and `pt.json` together
5. **Test both languages**: Switch language in Settings to verify translations

## Current Translation Files

- `/locales/en.json` - English translations
- `/locales/pt.json` - Portuguese translations

## Need Help?

If you need to add a new translation category:
1. Add the category to both `en.json` and `pt.json`
2. Use the category prefix in your keys: `t("category.key")`
3. Keep the structure consistent between both files


