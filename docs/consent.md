# Consent copy (KYC & Background Check)

Last updated: 2025-10-28
Version: 1.0

## ID verification consent (user-facing)

We collect and securely store images of your identity document (including passport, national ID, driver’s license, or Portuguese residence permit) and a selfie to:

- Verify your identity
- Prevent fraud and protect our community
- Confirm your right to work in Portugal where required by applicable law

Your data is encrypted and only accessible to authorized reviewers. We retain it only as long as needed for verification, dispute resolution, or legal obligations, after which it is deleted. By continuing, you consent to this processing as described in our Privacy Policy.

[Learn more](/privacy)

## Background check consent (user-facing)

We collect and securely store your criminal record certificate to verify eligibility for certain roles and help keep our marketplace safe. Your document is encrypted and only reviewed by authorized staff. We retain it only as long as necessary to meet legal, safety, and platform requirements. By continuing, you consent to this processing as described in our Privacy Policy.

[Learn more](/privacy)

## Developer notes

When displaying consent, show the exact text above and include:
- policy version (e.g., "2025-10-28"), and
- a SHA-256 hash of the full text shown to the user.

Send both `version` and `textHash` to the backend. The backend persists `consentAcceptedAt`, `consentVersion`, and `consentTextHash` on initiation of KYC and background checks.