import { ABOUT_EN } from "./guide-documents/about.en";
import { ABOUT_PT } from "./guide-documents/about.pt";
import { HOW_IT_WORKS_EN } from "./guide-documents/how-it-works.en";
import { HOW_IT_WORKS_PT } from "./guide-documents/how-it-works.pt";
import { FOR_EMPLOYERS_EN } from "./guide-documents/for-employers.en";
import { FOR_EMPLOYERS_PT } from "./guide-documents/for-employers.pt";
import { FOR_PROVIDERS_EN } from "./guide-documents/for-providers.en";
import { FOR_PROVIDERS_PT } from "./guide-documents/for-providers.pt";
import { EMPLOYER_POST_JOB_EN } from "./guide-documents/employer-post-job.en";
import { EMPLOYER_POST_JOB_PT } from "./guide-documents/employer-post-job.pt";
import { EMPLOYER_INSTANT_JOBS_EN } from "./guide-documents/employer-instant-jobs.en";
import { EMPLOYER_INSTANT_JOBS_PT } from "./guide-documents/employer-instant-jobs.pt";
import { EMPLOYER_NEGOTIATION_EN } from "./guide-documents/employer-negotiation.en";
import { EMPLOYER_NEGOTIATION_PT } from "./guide-documents/employer-negotiation.pt";
import { EMPLOYER_REFUND_EN } from "./guide-documents/employer-refund.en";
import { EMPLOYER_REFUND_PT } from "./guide-documents/employer-refund.pt";
import { EMPLOYER_NO_SHOW_EN } from "./guide-documents/employer-no-show.en";
import { EMPLOYER_NO_SHOW_PT } from "./guide-documents/employer-no-show.pt";
import { SP_KYC_EN } from "./guide-documents/sp-kyc.en";
import { SP_KYC_PT } from "./guide-documents/sp-kyc.pt";
import { SP_APPLY_JOBS_EN } from "./guide-documents/sp-apply-jobs.en";
import { SP_APPLY_JOBS_PT } from "./guide-documents/sp-apply-jobs.pt";
import { SP_SKILLS_EN } from "./guide-documents/sp-skills.en";
import { SP_SKILLS_PT } from "./guide-documents/sp-skills.pt";
import { SP_AVAILABILITY_EN } from "./guide-documents/sp-availability.en";
import { SP_AVAILABILITY_PT } from "./guide-documents/sp-availability.pt";
import { SP_ACCEPTING_EN } from "./guide-documents/sp-accepting.en";
import { SP_ACCEPTING_PT } from "./guide-documents/sp-accepting.pt";
import { SP_NEGOTIATION_EN } from "./guide-documents/sp-negotiation.en";
import { SP_NEGOTIATION_PT } from "./guide-documents/sp-negotiation.pt";
import { SP_NO_SHOW_EN } from "./guide-documents/sp-no-show.en";
import { SP_NO_SHOW_PT } from "./guide-documents/sp-no-show.pt";

type Language = "en" | "pt";
export type GuideType =
  | "ABOUT"
  | "HOW_IT_WORKS"
  | "FOR_EMPLOYERS"
  | "FOR_PROVIDERS"
  | "EMPLOYER_POST_JOB"
  | "EMPLOYER_INSTANT_JOBS"
  | "EMPLOYER_NEGOTIATION"
  | "EMPLOYER_REFUND"
  | "EMPLOYER_NO_SHOW"
  | "SP_KYC"
  | "SP_APPLY_JOBS"
  | "SP_SKILLS"
  | "SP_AVAILABILITY"
  | "SP_ACCEPTING"
  | "SP_NEGOTIATION"
  | "SP_NO_SHOW";

const guides: Record<GuideType, Record<Language, string>> = {
  ABOUT: { en: ABOUT_EN, pt: ABOUT_PT },
  HOW_IT_WORKS: { en: HOW_IT_WORKS_EN, pt: HOW_IT_WORKS_PT },
  FOR_EMPLOYERS: { en: FOR_EMPLOYERS_EN, pt: FOR_EMPLOYERS_PT },
  FOR_PROVIDERS: { en: FOR_PROVIDERS_EN, pt: FOR_PROVIDERS_PT },
  EMPLOYER_POST_JOB: { en: EMPLOYER_POST_JOB_EN, pt: EMPLOYER_POST_JOB_PT },
  EMPLOYER_INSTANT_JOBS: {
    en: EMPLOYER_INSTANT_JOBS_EN,
    pt: EMPLOYER_INSTANT_JOBS_PT,
  },
  EMPLOYER_NEGOTIATION: {
    en: EMPLOYER_NEGOTIATION_EN,
    pt: EMPLOYER_NEGOTIATION_PT,
  },
  EMPLOYER_REFUND: { en: EMPLOYER_REFUND_EN, pt: EMPLOYER_REFUND_PT },
  EMPLOYER_NO_SHOW: { en: EMPLOYER_NO_SHOW_EN, pt: EMPLOYER_NO_SHOW_PT },
  SP_KYC: { en: SP_KYC_EN, pt: SP_KYC_PT },
  SP_APPLY_JOBS: { en: SP_APPLY_JOBS_EN, pt: SP_APPLY_JOBS_PT },
  SP_SKILLS: { en: SP_SKILLS_EN, pt: SP_SKILLS_PT },
  SP_AVAILABILITY: { en: SP_AVAILABILITY_EN, pt: SP_AVAILABILITY_PT },
  SP_ACCEPTING: { en: SP_ACCEPTING_EN, pt: SP_ACCEPTING_PT },
  SP_NEGOTIATION: { en: SP_NEGOTIATION_EN, pt: SP_NEGOTIATION_PT },
  SP_NO_SHOW: { en: SP_NO_SHOW_EN, pt: SP_NO_SHOW_PT },
};

export function getGuideDocument(
  type: GuideType,
  language: Language = "en",
): string {
  return guides[type]?.[language] || guides[type]?.en || "";
}
