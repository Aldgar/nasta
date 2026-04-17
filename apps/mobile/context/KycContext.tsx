import React, { createContext, useContext, useReducer, ReactNode } from "react";

export type IdDocumentType = "PASSPORT" | "NATIONAL_ID" | "RESIDENCE_PERMIT";

export interface CapturedImage {
  uri: string;
  width: number;
  height: number;
}

interface KycState {
  // Step 1
  documentCountry: string;
  documentType: IdDocumentType | null;

  // Step 2-4 captures
  idFront: CapturedImage | null;
  idBack: CapturedImage | null;
  selfie: CapturedImage | null;

  // Criminal record
  criminalRecord: { uri: string; type: "pdf" | "image" } | null;

  // Driver's license (optional)
  includeDriversLicense: boolean;
  dlFront: CapturedImage | null;
  dlBack: CapturedImage | null;

  // Vehicle (optional, tied to driver's license)
  includeVehicle: boolean;

  // Certifications (optional, multiple)
  certifications: { uri: string; name: string; type: "pdf" | "image" }[];

  // CV / Resume (optional, multiple)
  cvDocuments: { uri: string; name: string; type: "pdf" | "image" }[];

  // Submission
  verificationId: string | null;
  submitting: boolean;
  error: string | null;
}

type KycAction =
  | { type: "SET_DOCUMENT_COUNTRY"; country: string }
  | { type: "SET_DOCUMENT_TYPE"; docType: IdDocumentType }
  | { type: "SET_ID_FRONT"; image: CapturedImage }
  | { type: "SET_ID_BACK"; image: CapturedImage }
  | { type: "SET_SELFIE"; image: CapturedImage }
  | { type: "SET_CRIMINAL_RECORD"; doc: { uri: string; type: "pdf" | "image" } }
  | { type: "SET_INCLUDE_DRIVERS_LICENSE"; include: boolean }
  | { type: "SET_DL_FRONT"; image: CapturedImage }
  | { type: "SET_DL_BACK"; image: CapturedImage }
  | { type: "SET_INCLUDE_VEHICLE"; include: boolean }
  | {
      type: "ADD_CERTIFICATION";
      doc: { uri: string; name: string; type: "pdf" | "image" };
    }
  | { type: "REMOVE_CERTIFICATION"; index: number }
  | {
      type: "ADD_CV";
      doc: { uri: string; name: string; type: "pdf" | "image" };
    }
  | { type: "REMOVE_CV"; index: number }
  | { type: "SET_VERIFICATION_ID"; id: string }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

const initialState: KycState = {
  documentCountry: "",
  documentType: null,
  idFront: null,
  idBack: null,
  selfie: null,
  criminalRecord: null,
  includeDriversLicense: false,
  dlFront: null,
  dlBack: null,
  includeVehicle: false,
  certifications: [],
  cvDocuments: [],
  verificationId: null,
  submitting: false,
  error: null,
};

function kycReducer(state: KycState, action: KycAction): KycState {
  switch (action.type) {
    case "SET_DOCUMENT_COUNTRY":
      return { ...state, documentCountry: action.country };
    case "SET_DOCUMENT_TYPE":
      return {
        ...state,
        documentType: action.docType,
        idFront: null,
        idBack: null,
      };
    case "SET_ID_FRONT":
      return { ...state, idFront: action.image };
    case "SET_ID_BACK":
      return { ...state, idBack: action.image };
    case "SET_SELFIE":
      return { ...state, selfie: action.image };
    case "SET_CRIMINAL_RECORD":
      return { ...state, criminalRecord: action.doc };
    case "SET_INCLUDE_DRIVERS_LICENSE":
      return {
        ...state,
        includeDriversLicense: action.include,
        dlFront: action.include ? state.dlFront : null,
        dlBack: action.include ? state.dlBack : null,
      };
    case "SET_DL_FRONT":
      return { ...state, dlFront: action.image };
    case "SET_DL_BACK":
      return { ...state, dlBack: action.image };
    case "SET_INCLUDE_VEHICLE":
      return { ...state, includeVehicle: action.include };
    case "ADD_CERTIFICATION":
      return {
        ...state,
        certifications: [...state.certifications, action.doc],
      };
    case "REMOVE_CERTIFICATION":
      return {
        ...state,
        certifications: state.certifications.filter(
          (_, i) => i !== action.index,
        ),
      };
    case "ADD_CV":
      return { ...state, cvDocuments: [...state.cvDocuments, action.doc] };
    case "REMOVE_CV":
      return {
        ...state,
        cvDocuments: state.cvDocuments.filter((_, i) => i !== action.index),
      };
    case "SET_VERIFICATION_ID":
      return { ...state, verificationId: action.id };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.submitting };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface KycContextType {
  state: KycState;
  dispatch: React.Dispatch<KycAction>;
  /** Whether the document type requires a back image */
  requiresBack: boolean;
  /** Total number of steps (dynamic based on options) */
  totalSteps: number;
}

const KycContext = createContext<KycContextType | undefined>(undefined);

export function KycProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(kycReducer, initialState);

  const requiresBack =
    state.documentType === "NATIONAL_ID" ||
    state.documentType === "RESIDENCE_PERMIT";

  // Steps: docType(1) + front(2) + back?(3) + selfie + review + criminalRecord + driverLicense + certsAndCv + processing
  // Back is conditional, driverLicense is separate screen
  const baseSteps = requiresBack ? 8 : 7;
  const totalSteps = baseSteps;

  return (
    <KycContext.Provider value={{ state, dispatch, requiresBack, totalSteps }}>
      {children}
    </KycContext.Provider>
  );
}

export function useKyc() {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error("useKyc must be used within KycProvider");
  return ctx;
}
