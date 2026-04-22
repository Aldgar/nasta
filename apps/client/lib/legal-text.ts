import { TERMS_OF_SERVICE_EN } from "./legal-documents/terms-of-service.en";
import { TERMS_OF_SERVICE_PT } from "./legal-documents/terms-of-service.pt";
import { PRIVACY_POLICY_EN } from "./legal-documents/privacy-policy.en";
import { PRIVACY_POLICY_PT } from "./legal-documents/privacy-policy.pt";
import { PLATFORM_RULES_EN } from "./legal-documents/platform-rules.en";
import { PLATFORM_RULES_PT } from "./legal-documents/platform-rules.pt";
import { COOKIES_EN } from "./legal-documents/cookies.en";
import { COOKIES_PT } from "./legal-documents/cookies.pt";
import { EMPLOYER_REFUND_EN } from "./guide-documents/employer-refund.en";
import { EMPLOYER_REFUND_PT } from "./guide-documents/employer-refund.pt";

const dateEN = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const datePT = new Date().toLocaleDateString("pt-PT", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * Replace `${new Date().toLocaleDateString(...)}` template-literal placeholders
 * (which arrive as raw strings from the .ts source files) with a concrete
 * formatted date string.
 */
function processDatePlaceholders(
  content: string,
  language: "en" | "pt",
): string {
  const formatted = language === "pt" ? datePT : dateEN;
  // Match ${ ... toLocaleDateString( ... ) ... } including nested braces in the options object.
  return content.replace(
    /\$\{new Date\(\)\.toLocaleDateString\([^}]*\{[^}]*\}\)\}/g,
    formatted,
  );
}

const ACCOUNT_DELETION_EN = `
# Delete Your Account

**Last Updated: ${dateEN}**

## How to request account deletion

- Open the Nasta mobile app
- Go to **Settings**
- Tap **Delete account**
- Select a reason, optionally add details, confirm, and submit

## What happens next

- We will process your request and delete your account and associated personal data.
- Some information may be retained when necessary for legal, security, fraud-prevention, or financial record-keeping purposes.

## If you cannot access the app

- Email **support@nasta.app** from the email address associated with your account.
- Use the subject: **Account Deletion Request**
`;

const ACCOUNT_DELETION_PT = `
# Eliminar a Sua Conta

**Última Atualização: ${datePT}**

## Como solicitar a eliminação da conta

- Abra a aplicação móvel Nasta
- Vá a **Definições**
- Toque em **Eliminar conta**
- Selecione um motivo, opcionalmente adicione detalhes, confirme e submeta

## O que acontece a seguir

- Processaremos o seu pedido e eliminaremos a sua conta e dados pessoais associados.
- Algumas informações podem ser retidas quando necessário para fins legais, de segurança, prevenção de fraude ou manutenção de registos financeiros.

## Se não conseguir aceder à aplicação

- Envie email para **support@nasta.app** a partir do endereço de email associado à sua conta.
- Utilize o assunto: **Pedido de Eliminação de Conta**
`;

const LEGAL_EN = {
  TERMS_OF_SERVICE: processDatePlaceholders(TERMS_OF_SERVICE_EN, "en"),
  PRIVACY_POLICY: processDatePlaceholders(PRIVACY_POLICY_EN, "en"),
  COOKIES: processDatePlaceholders(COOKIES_EN, "en"),
  PLATFORM_RULES: processDatePlaceholders(PLATFORM_RULES_EN, "en"),
  ACCOUNT_DELETION: ACCOUNT_DELETION_EN,
  REFUND_POLICY: EMPLOYER_REFUND_EN,
};

const LEGAL_PT: typeof LEGAL_EN = {
  TERMS_OF_SERVICE: processDatePlaceholders(TERMS_OF_SERVICE_PT, "pt"),
  PRIVACY_POLICY: processDatePlaceholders(PRIVACY_POLICY_PT, "pt"),
  COOKIES: processDatePlaceholders(COOKIES_PT, "pt"),
  PLATFORM_RULES: processDatePlaceholders(PLATFORM_RULES_PT, "pt"),
  ACCOUNT_DELETION: ACCOUNT_DELETION_PT,
  REFUND_POLICY: EMPLOYER_REFUND_PT,
};

export type LegalTextKeys = keyof typeof LEGAL_EN;

const LEGAL_TEXTS: Record<string, typeof LEGAL_EN> = {
  en: LEGAL_EN,
  pt: LEGAL_PT,
};

/** Return legal text object for the given language (falls back to English). */
export function getLegalText(lang: string): typeof LEGAL_EN {
  return LEGAL_TEXTS[lang] ?? LEGAL_EN;
}

/** Legacy export – English text for backwards compatibility. */
export const LEGAL_TEXT = LEGAL_EN;
