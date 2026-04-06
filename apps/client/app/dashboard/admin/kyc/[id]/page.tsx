"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, API_BASE } from "../../../../../lib/api";
import Avatar from "../../../../../components/Avatar";

/* ─── Types ─── */
interface CertDoc {
  url: string;
  status: string;
  uploadedAt: string;
}

interface Vehicle {
  id: string;
  vehicleType: string;
  otherTypeSpecification?: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  licensePlate: string;
  capacity?: string;
  photoFrontUrl?: string;
  photoBackUrl?: string;
  photoLeftUrl?: string;
  photoRightUrl?: string;
  vehicleLicenseUrl?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
}

interface ExtractedData {
  legalFirstName?: string;
  legalLastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  placeOfBirth?: string;
  documentNumber?: string;
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  bsnNumber?: string;
  address?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  photoMatchConfirmed?: boolean;
  workAuthorization?: string;
  adminNotes?: string;
  isEuCitizen?: boolean;
  citizenshipCountry?: string;
}

interface VerificationDetail {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    role?: string;
    country?: string;
    isIdVerified: boolean;
    idVerificationStatus: string;
  };
  verificationType: string;
  status: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  certifications?: CertDoc[];
  cvDocuments?: CertDoc[];
  documentNumber?: string;
  documentCountry?: string;
  documentExpiry?: string;
  documentStatuses?: Record<string, unknown>;
  confidence?: number;
  faceMatch?: number;
  livenessCheck?: boolean;
  extractedData?: ExtractedData;
  extractedBy?: string;
  extractedAt?: string;
  createdAt: string;
  updatedAt: string;
  allVerifications?: {
    id: string;
    verificationType: string;
    status: string;
    documentFrontUrl?: string;
    documentBackUrl?: string;
    selfieUrl?: string;
    documentStatuses?: Record<string, unknown>;
    createdAt: string;
  }[];
  backgroundCheck?: {
    id: string;
    status: string;
    uploadedDocument?: string;
    certificateNumber?: string;
    submittedAt?: string;
    createdAt: string;
  };
  vehicles?: Vehicle[];
}

/* ─── Helpers ─── */
function resolveUrl(raw?: string | null): string {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  const base = API_BASE.replace(/\/+$/, "");
  const path = raw.startsWith("/") ? raw.slice(1) : raw;
  return `${base}/${path}`;
}

function statusColor(s: string) {
  if (s === "PENDING") return "bg-yellow-500/20 text-yellow-300";
  if (s === "IN_PROGRESS") return "bg-blue-500/20 text-blue-300";
  if (s === "MANUAL_REVIEW") return "bg-orange-500/20 text-orange-300";
  if (s === "APPROVED" || s === "VERIFIED")
    return "bg-green-500/20 text-green-300";
  if (s === "REJECTED" || s === "FAILED") return "bg-red-500/20 text-red-300";
  return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── Image component with error handling ─── */
function DocImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const resolved = resolveUrl(src);

  if (!resolved || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-xs text-[var(--muted-text)] ${className || ""}`}
      >
        <div className="text-center p-4">
          <svg
            className="mx-auto mb-1 h-6 w-6 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          <p>Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <a href={resolved} target="_blank" rel="noopener noreferrer">
      <img
        src={resolved}
        alt={alt}
        onError={() => setError(true)}
        className={`rounded-lg border border-[var(--border-color)] object-cover cursor-zoom-in hover:opacity-90 transition-opacity ${className || ""}`}
      />
    </a>
  );
}

/* ─── Section wrapper ─── */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--muted-text)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ─── Info cell ─── */
function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-[var(--background)] p-3">
      <p className="text-[10px] uppercase text-[var(--muted-text)]">{label}</p>
      <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

/* ─── Country lists ─── */
const EU_COUNTRIES = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  // EEA + Switzerland (treated as EU for work rights)
  "Iceland",
  "Liechtenstein",
  "Norway",
  "Switzerland",
];

const NON_EU_COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (DRC)",
  "Congo (Republic)",
  "Costa Rica",
  "Côte d'Ivoire",
  "Cuba",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Gabon",
  "Gambia",
  "Georgia",
  "Ghana",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Israel",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Qatar",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "São Tomé and Príncipe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

/* ─── MRZ helpers ─── */
function extractMrzLines(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim().replace(/\s/g, "").toUpperCase());
  // MRZ lines: only A-Z, 0-9, < and must contain filler <
  const mrzPattern = /^[A-Z0-9<]{28,44}$/;
  const candidates = lines.filter(
    (l) => mrzPattern.test(l) && (l.match(/</g) || []).length >= 2,
  );
  // MRZ is at the bottom — take the last 2-3 matching lines
  return candidates.slice(-3);
}

function mrzDateToIso(d: string): string {
  if (!d || d.length !== 6) return "";
  const yy = parseInt(d.substring(0, 2), 10);
  const year = yy > 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${d.substring(2, 4)}-${d.substring(4, 6)}`;
}

function capitalizeWords(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ─── Form field ─── */
function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "textarea";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
      )}
    </div>
  );
}

/* ─── Service Provider Info Tab (Document Scanning) ─── */
function ServiceProviderInfoTab({
  data,
  onSaved,
}: {
  data: VerificationDetail;
  onSaved: () => void;
}) {
  const existing = (data.extractedData || {}) as ExtractedData;
  const [form, setForm] = useState<ExtractedData>({
    legalFirstName: existing.legalFirstName || "",
    legalLastName: existing.legalLastName || "",
    dateOfBirth: existing.dateOfBirth || "",
    gender: existing.gender || "",
    nationality: existing.nationality || "",
    placeOfBirth: existing.placeOfBirth || "",
    documentNumber: existing.documentNumber || "",
    documentType: existing.documentType || "",
    issueDate: existing.issueDate || "",
    expiryDate: existing.expiryDate || "",
    issuingCountry: existing.issuingCountry || "",
    issuingAuthority: existing.issuingAuthority || "",
    bsnNumber: existing.bsnNumber || "",
    address: existing.address || "",
    mrzLine1: existing.mrzLine1 || "",
    mrzLine2: existing.mrzLine2 || "",
    photoMatchConfirmed: existing.photoMatchConfirmed || false,
    workAuthorization: existing.workAuthorization || "",
    adminNotes: existing.adminNotes || "",
    isEuCitizen: existing.isEuCitizen ?? undefined,
    citizenshipCountry: existing.citizenshipCountry || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  const set = (key: keyof ExtractedData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await api(`/kyc/admin/${data.id}/extracted-data`, {
      method: "POST",
      body: form,
    });
    setSaving(false);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 3000);
  };

  const docTypes = [
    "Passport",
    "National ID Card",
    "Residence Permit",
    "EU Citizen Card",
    "Drivers License",
    "Other",
  ];

  const genderOptions = ["Male", "Female", "Other"];

  // Which document image to show in the reference panel
  const [refImage, setRefImage] = useState<"front" | "back" | "selfie">(
    "front",
  );

  const getRefImageUrl = () => {
    if (refImage === "front") return data.documentFrontUrl;
    if (refImage === "back") return data.documentBackUrl;
    return data.selfieUrl;
  };

  const handleScanMrz = async () => {
    const imageUrl = getRefImageUrl();
    if (!imageUrl) {
      setScanError("No document image selected. Switch to front or back.");
      return;
    }
    setScanning(true);
    setScanError(null);
    setScanSuccess(false);
    setScanProgress("Loading OCR engine...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setScanProgress(`Scanning... ${Math.round(m.progress * 100)}%`);
          } else {
            setScanProgress(m.status);
          }
        },
      });
      setScanProgress("Reading document...");
      const resolved = imageUrl.startsWith("http")
        ? imageUrl
        : `${API_BASE}${imageUrl}`;
      const {
        data: { text },
      } = await worker.recognize(resolved);
      await worker.terminate();

      // Extract MRZ lines from OCR text
      const mrzLines = extractMrzLines(text);
      if (mrzLines.length < 2) {
        setScanError(
          "Could not detect MRZ zone in this image. Try the back of the document, or enter details manually.",
        );
        setScanning(false);
        setScanProgress("");
        return;
      }

      // Parse MRZ
      const { parse: parseMrz } = await import("mrz");
      const mrzText = mrzLines.slice(-2).join("\n"); // last 2 lines for TD2/TD3
      let result;
      try {
        result = parseMrz(mrzText);
      } catch {
        // Try 3-line format (TD1) if 2-line fails
        if (mrzLines.length >= 3) {
          result = parseMrz(mrzLines.slice(-3).join("\n"));
        } else {
          throw new Error(
            "MRZ detected but could not be parsed. OCR quality may be insufficient.",
          );
        }
      }

      const f = result.fields;
      // Map parsed MRZ fields into form
      const updates: Partial<ExtractedData> = {
        mrzLine1: mrzLines[mrzLines.length - 2] || "",
        mrzLine2: mrzLines[mrzLines.length - 1] || "",
      };
      if (f.firstName) updates.legalFirstName = capitalizeWords(f.firstName);
      if (f.lastName) updates.legalLastName = capitalizeWords(f.lastName);
      if (f.birthDate) updates.dateOfBirth = mrzDateToIso(f.birthDate);
      if (f.sex)
        updates.gender =
          f.sex === "male" ? "Male" : f.sex === "female" ? "Female" : "Other";
      if (f.nationality) updates.nationality = f.nationality;
      if (f.issuingState) updates.issuingCountry = f.issuingState;
      if (f.documentNumber) updates.documentNumber = f.documentNumber;
      if (f.expirationDate) updates.expiryDate = mrzDateToIso(f.expirationDate);
      if (f.documentCode) {
        const code = f.documentCode;
        if (code === "P") updates.documentType = "Passport";
        else if (code === "I" || code === "ID")
          updates.documentType = "National ID Card";
      }

      setForm((prev) => ({ ...prev, ...updates }));
      setScanSuccess(true);
      setScanProgress("");
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Scan failed. Try manually.",
      );
      setScanProgress("");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-300">
              Document Scanning &amp; Data Extraction
            </p>
            <p className="mt-1 text-xs text-blue-300/80">
              Use &quot;Scan MRZ from Document&quot; to automatically read the
              Machine Readable Zone and fill in personal details. Review the
              auto-filled data, make corrections if needed, then enter any
              remaining fields manually. Use the image switcher to toggle
              between front, back, and selfie views.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Document reference images */}
        <div className="space-y-3">
          <Section title="Document Reference">
            {/* Image switcher */}
            <div className="flex gap-2 mb-3">
              {(["front", "back", "selfie"] as const).map((img) => {
                const hasImage =
                  img === "front"
                    ? data.documentFrontUrl
                    : img === "back"
                      ? data.documentBackUrl
                      : data.selfieUrl;
                return (
                  <button
                    key={img}
                    onClick={() => setRefImage(img)}
                    disabled={!hasImage}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      refImage === img
                        ? "bg-[var(--primary)] text-white"
                        : hasImage
                          ? "bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                          : "bg-[var(--background)] text-[var(--muted-text)] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {img}
                  </button>
                );
              })}
            </div>

            {/* Reference image */}
            {getRefImageUrl() ? (
              <DocImage
                src={getRefImageUrl()!}
                alt={`Document ${refImage}`}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                <p className="text-xs text-[var(--muted-text)]">
                  No {refImage} image available
                </p>
              </div>
            )}
          </Section>

          {/* Photo Match */}
          <Section title="Photo Verification">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  set("photoMatchConfirmed", !form.photoMatchConfirmed)
                }
                className={`flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.photoMatchConfirmed
                    ? "bg-green-500"
                    : "bg-[var(--surface-alt)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.photoMatchConfirmed ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium ${form.photoMatchConfirmed ? "text-green-400" : "text-[var(--muted-text)]"}`}
              >
                {form.photoMatchConfirmed
                  ? "Selfie matches document photo"
                  : "Photo match not confirmed"}
              </span>
            </div>
          </Section>

          {/* MRZ Scan */}
          <Section title="MRZ (Machine Readable Zone)">
            <p className="mb-3 text-[10px] text-[var(--muted-text)]">
              Scan the document image to auto-detect the MRZ and fill in
              personal details. Make sure to select the correct document side
              (front/back) above before scanning.
            </p>

            <button
              onClick={handleScanMrz}
              disabled={scanning || !getRefImageUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {scanning ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {scanProgress || "Scanning..."}
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Scan MRZ from Document
                </>
              )}
            </button>

            {scanError && (
              <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-xs text-red-400">{scanError}</p>
              </div>
            )}

            {scanSuccess && (
              <div className="mt-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                <p className="text-xs text-green-400 font-medium">
                  MRZ scanned successfully — form fields auto-filled. Please
                  review and correct if needed.
                </p>
              </div>
            )}

            {/* Show detected MRZ (read-only) */}
            {(form.mrzLine1 || form.mrzLine2) && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
                  Detected MRZ
                </p>
                <div className="rounded-lg bg-[var(--background)] p-3 font-mono text-xs text-[var(--foreground)] break-all select-all">
                  {form.mrzLine1 && <p>{form.mrzLine1}</p>}
                  {form.mrzLine2 && <p>{form.mrzLine2}</p>}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Right: Data entry form */}
        <div className="space-y-3">
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Legal First Name"
                value={form.legalFirstName || ""}
                onChange={(v) => set("legalFirstName", v)}
                placeholder="As shown on document"
                required
              />
              <FormField
                label="Legal Last Name"
                value={form.legalLastName || ""}
                onChange={(v) => set("legalLastName", v)}
                placeholder="As shown on document"
                required
              />
              <FormField
                label="Date of Birth"
                value={form.dateOfBirth || ""}
                onChange={(v) => set("dateOfBirth", v)}
                type="date"
                required
              />
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
                  Gender
                </label>
                <select
                  value={form.gender || ""}
                  onChange={(e) => set("gender", e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                >
                  <option value="">Select...</option>
                  {genderOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
                  Citizenship <span className="text-red-400 ml-0.5">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        isEuCitizen: true,
                        citizenshipCountry: "",
                        nationality: "",
                      }));
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      form.isEuCitizen === true
                        ? "bg-blue-600 text-white"
                        : "bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    EU / EEA Citizen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        isEuCitizen: false,
                        citizenshipCountry: "",
                        nationality: "",
                      }));
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      form.isEuCitizen === false
                        ? "bg-amber-600 text-white"
                        : "bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    Non-EU Citizen
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
                  Country of Citizenship{" "}
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={form.citizenshipCountry || ""}
                  onChange={(e) => {
                    const country = e.target.value;
                    set("citizenshipCountry", country);
                    set("nationality", country);
                  }}
                  disabled={form.isEuCitizen === undefined}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 disabled:opacity-50"
                >
                  <option value="">
                    {form.isEuCitizen === undefined
                      ? "Select citizenship type first"
                      : "Select country..."}
                  </option>
                  {(form.isEuCitizen ? EU_COUNTRIES : NON_EU_COUNTRIES).map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {form.isEuCitizen === false && (
                <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-300 font-medium">
                    Non-EU citizen document monitoring active
                  </p>
                  <p className="text-[10px] text-amber-300/70 mt-1">
                    Document expiry will be tracked. The service provider will
                    be notified 15 days before expiry and access will be
                    restricted if documents expire without renewal.
                  </p>
                </div>
              )}
              <FormField
                label="Place of Birth"
                value={form.placeOfBirth || ""}
                onChange={(v) => set("placeOfBirth", v)}
                placeholder="City / Country"
              />
            </div>
          </Section>

          <Section title="Document Information">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--muted-text)]">
                  Document Type
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={form.documentType || ""}
                  onChange={(e) => set("documentType", e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                >
                  <option value="">Select...</option>
                  {docTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <FormField
                label="Document Number"
                value={form.documentNumber || ""}
                onChange={(v) => set("documentNumber", v)}
                placeholder="As shown on document"
                required
              />
              <FormField
                label="Issue Date"
                value={form.issueDate || ""}
                onChange={(v) => set("issueDate", v)}
                type="date"
              />
              <FormField
                label="Expiry Date"
                value={form.expiryDate || ""}
                onChange={(v) => set("expiryDate", v)}
                type="date"
                required
              />
              <FormField
                label="Issuing Country"
                value={form.issuingCountry || ""}
                onChange={(v) => set("issuingCountry", v)}
                placeholder="e.g. NL, PT, DE"
                required
              />
              <FormField
                label="Issuing Authority"
                value={form.issuingAuthority || ""}
                onChange={(v) => set("issuingAuthority", v)}
                placeholder="e.g. Municipality of Amsterdam"
              />
            </div>
          </Section>

          <Section title="Additional Details">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="BSN / Tax Number"
                value={form.bsnNumber || ""}
                onChange={(v) => set("bsnNumber", v)}
                placeholder="If visible on document"
              />
              <FormField
                label="Work Authorization"
                value={form.workAuthorization || ""}
                onChange={(v) => set("workAuthorization", v)}
                placeholder="e.g. Unrestricted, Work permit required"
              />
              <div className="col-span-2">
                <FormField
                  label="Address (if on document)"
                  value={form.address || ""}
                  onChange={(v) => set("address", v)}
                  placeholder="Full address as shown on document"
                />
              </div>
              <div className="col-span-2">
                <FormField
                  label="Admin Notes"
                  value={form.adminNotes || ""}
                  onChange={(v) => set("adminNotes", v)}
                  type="textarea"
                  placeholder="Any additional observations, discrepancies, or notes..."
                />
              </div>
            </div>
          </Section>

          {/* Save button */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <div>
              {data.extractedAt && (
                <p className="text-[10px] text-[var(--muted-text)]">
                  Last saved: {formatDate(data.extractedAt)}
                </p>
              )}
              {saved && (
                <p className="text-xs text-green-400 font-medium">
                  Saved successfully
                </p>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Saving..." : "Save Document Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function KYCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewAction, setReviewAction] = useState<
    "APPROVED" | "REJECTED" | null
  >(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "identity" | "documents" | "vehicles" | "background" | "provider-info"
  >("identity");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res = await api<VerificationDetail>(`/kyc/admin/${id}`);
    if (res.data) setData(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api<VerificationDetail>(`/kyc/admin/${id}`);
      if (!cancelled && res.data) setData(res.data);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleReview = async () => {
    if (!data || !reviewAction) return;
    setActionLoading(true);
    await api(`/kyc/admin/${data.id}/review`, {
      method: "POST",
      body: { decision: reviewAction, notes: reviewNotes || undefined },
    });
    setActionLoading(false);
    setReviewAction(null);
    setReviewNotes("");
    fetchDetail();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-[var(--muted-text)]">Verification not found.</p>
        <Link
          href="/dashboard/admin/kyc"
          className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline"
        >
          ← Back to list
        </Link>
      </div>
    );
  }

  const user = data.user;
  const certs = Array.isArray(data.certifications) ? data.certifications : [];
  const cvs = Array.isArray(data.cvDocuments) ? data.cvDocuments : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  const allVerifs = Array.isArray(data.allVerifications)
    ? data.allVerifications
    : [];
  const isReviewable = ["PENDING", "IN_PROGRESS", "MANUAL_REVIEW"].includes(
    data.status,
  );

  const tabs = [
    { key: "identity" as const, label: "Identity & Documents" },
    { key: "documents" as const, label: "Certifications & CVs" },
    { key: "vehicles" as const, label: `Vehicles (${vehicles.length})` },
    { key: "background" as const, label: "Background Check" },
    {
      key: "provider-info" as const,
      label: `Service Provider Info${data.extractedData ? " ✓" : ""}`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/kyc"
          className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-text)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Back
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            KYC Review — {user.firstName} {user.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted-text)]">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusColor(data.status)}`}
        >
          {data.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* User Summary Card */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-5">
          <Avatar
            src={resolveUrl(user.avatarUrl)}
            alt="Avatar"
            imgClassName="h-16 w-16 rounded-full border-2 border-[var(--border-color)] object-cover"
            fallback={
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/20 text-lg font-bold text-[var(--primary)]">
                {(user.firstName?.[0] || "?").toUpperCase()}
              </div>
            }
          />
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoCell label="Role" value={user.role?.replace(/_/g, " ")} />
            <InfoCell label="Country" value={user.country} />
            <InfoCell
              label="ID Verified"
              value={
                <span
                  className={
                    user.isIdVerified ? "text-green-400" : "text-yellow-400"
                  }
                >
                  {user.isIdVerified ? "Yes" : "No"}
                </span>
              }
            />
            <InfoCell label="Submitted" value={formatDate(data.createdAt)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === t.key
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "identity" && (
        <div className="space-y-5">
          {/* Verification Info */}
          <Section title="Verification Details">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <InfoCell
                label="Status"
                value={
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(data.status)}`}
                  >
                    {data.status.replace(/_/g, " ")}
                  </span>
                }
              />
              <InfoCell
                label="Verification Type"
                value={data.verificationType?.replace(/_/g, " ")}
              />
              <InfoCell label="Document Number" value={data.documentNumber} />
              <InfoCell label="Document Country" value={data.documentCountry} />
              <InfoCell
                label="Document Expiry"
                value={
                  data.documentExpiry
                    ? formatDate(data.documentExpiry)
                    : undefined
                }
              />
              <InfoCell label="Submitted" value={formatDate(data.createdAt)} />
              <InfoCell
                label="Last Updated"
                value={formatDate(data.updatedAt)}
              />
              {data.confidence != null && (
                <InfoCell
                  label="Confidence Score"
                  value={`${(data.confidence * 100).toFixed(1)}%`}
                />
              )}
              {data.faceMatch != null && (
                <InfoCell
                  label="Face Match Score"
                  value={`${(data.faceMatch * 100).toFixed(1)}%`}
                />
              )}
              {data.livenessCheck != null && (
                <InfoCell
                  label="Liveness Check"
                  value={
                    <span
                      className={
                        data.livenessCheck ? "text-green-400" : "text-red-400"
                      }
                    >
                      {data.livenessCheck ? "Passed" : "Failed"}
                    </span>
                  }
                />
              )}
            </div>
          </Section>

          {/* ID Document Images */}
          <Section title="ID Documents">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.documentFrontUrl ? (
                <div>
                  <p className="mb-1.5 text-xs text-[var(--muted-text)]">
                    Front
                  </p>
                  <DocImage
                    src={data.documentFrontUrl}
                    alt="Document Front"
                    className="w-full aspect-[4/3]"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                  <p className="text-xs text-[var(--muted-text)]">
                    No front uploaded
                  </p>
                </div>
              )}
              {data.documentBackUrl ? (
                <div>
                  <p className="mb-1.5 text-xs text-[var(--muted-text)]">
                    Back
                  </p>
                  <DocImage
                    src={data.documentBackUrl}
                    alt="Document Back"
                    className="w-full aspect-[4/3]"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                  <p className="text-xs text-[var(--muted-text)]">
                    No back uploaded
                  </p>
                </div>
              )}
              {data.selfieUrl ? (
                <div>
                  <p className="mb-1.5 text-xs text-[var(--muted-text)]">
                    Selfie
                  </p>
                  <DocImage
                    src={data.selfieUrl}
                    alt="Selfie"
                    className="w-full aspect-[4/3]"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                  <p className="text-xs text-[var(--muted-text)]">
                    No selfie uploaded
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Extracted Document Data (read-only, synced from Service Provider Info) */}
          {data.extractedData ? (
            <Section title="Extracted Document Data">
              <p className="mb-3 text-xs text-[var(--muted-text)]">
                Data extracted and verified via the Service Provider Info tab.
                Edit in the &quot;Service Provider Info&quot; tab.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoCell
                  label="Legal First Name"
                  value={
                    (data.extractedData as ExtractedData).legalFirstName || "—"
                  }
                />
                <InfoCell
                  label="Legal Last Name"
                  value={
                    (data.extractedData as ExtractedData).legalLastName || "—"
                  }
                />
                <InfoCell
                  label="Date of Birth"
                  value={
                    (data.extractedData as ExtractedData).dateOfBirth
                      ? formatDate(
                          (data.extractedData as ExtractedData).dateOfBirth!,
                        )
                      : "—"
                  }
                />
                <InfoCell
                  label="Gender"
                  value={(data.extractedData as ExtractedData).gender || "—"}
                />
                <InfoCell
                  label="Citizenship"
                  value={
                    (data.extractedData as ExtractedData).isEuCitizen === true
                      ? "EU / EEA Citizen"
                      : (data.extractedData as ExtractedData).isEuCitizen ===
                          false
                        ? "Non-EU Citizen"
                        : "—"
                  }
                />
                <InfoCell
                  label="Country of Citizenship"
                  value={
                    (data.extractedData as ExtractedData).citizenshipCountry ||
                    "—"
                  }
                />
                <InfoCell
                  label="Document Type"
                  value={
                    (data.extractedData as ExtractedData).documentType || "—"
                  }
                />
                <InfoCell
                  label="Document Number"
                  value={
                    (data.extractedData as ExtractedData).documentNumber || "—"
                  }
                />
                <InfoCell
                  label="Issue Date"
                  value={
                    (data.extractedData as ExtractedData).issueDate
                      ? formatDate(
                          (data.extractedData as ExtractedData).issueDate!,
                        )
                      : "—"
                  }
                />
                <InfoCell
                  label="Expiry Date"
                  value={
                    (data.extractedData as ExtractedData).expiryDate
                      ? formatDate(
                          (data.extractedData as ExtractedData).expiryDate!,
                        )
                      : "—"
                  }
                />
                <InfoCell
                  label="Issuing Country"
                  value={
                    (data.extractedData as ExtractedData).issuingCountry || "—"
                  }
                />
                <InfoCell
                  label="Issuing Authority"
                  value={
                    (data.extractedData as ExtractedData).issuingAuthority ||
                    "—"
                  }
                />
                <InfoCell
                  label="BSN / Tax Number"
                  value={(data.extractedData as ExtractedData).bsnNumber || "—"}
                />
                <InfoCell
                  label="Work Authorization"
                  value={
                    (data.extractedData as ExtractedData).workAuthorization ||
                    "—"
                  }
                />
                <InfoCell
                  label="Photo Match"
                  value={
                    (data.extractedData as ExtractedData)
                      .photoMatchConfirmed ? (
                      <span className="text-green-400">Confirmed</span>
                    ) : (
                      <span className="text-yellow-400">Not confirmed</span>
                    )
                  }
                />
              </div>
              {(data.extractedData as ExtractedData).adminNotes && (
                <div className="mt-3 rounded-lg bg-[var(--background)] p-3">
                  <p className="text-[10px] uppercase text-[var(--muted-text)]">
                    Admin Notes
                  </p>
                  <p className="mt-1 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                    {(data.extractedData as ExtractedData).adminNotes}
                  </p>
                </div>
              )}
            </Section>
          ) : (
            <Section title="Extracted Document Data">
              <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)] p-6 text-center">
                <p className="text-xs text-[var(--muted-text)]">
                  No document data has been extracted yet. Go to the
                  &quot;Service Provider Info&quot; tab to scan and enter
                  document details.
                </p>
              </div>
            </Section>
          )}

          {/* Profile Details */}
          <Section title="Profile Details">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <InfoCell
                label="Full Name (Profile)"
                value={
                  user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : "—"
                }
              />
              <InfoCell label="Email" value={user.email} />
              <InfoCell label="Phone" value={user.phone || "—"} />
              <InfoCell label="Country (Profile)" value={user.country || "—"} />
              <InfoCell
                label="Document Number (Submitted)"
                value={data.documentNumber || "—"}
              />
              <InfoCell
                label="Issuing Country (Submitted)"
                value={data.documentCountry || "—"}
              />
              <InfoCell
                label="Expiry Date (Submitted)"
                value={
                  data.documentExpiry ? formatDate(data.documentExpiry) : "—"
                }
              />
            </div>
          </Section>

          {/* All Verifications History */}
          {allVerifs.length > 1 && (
            <Section title="Verification History">
              <div className="space-y-2">
                {allVerifs.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      v.id === data.id
                        ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                        : "bg-[var(--background)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(v.status)}`}
                      >
                        {v.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-[var(--foreground)]">
                        {v.verificationType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[var(--muted-text)]">
                        {formatDate(v.createdAt)}
                      </span>
                      {v.id !== data.id && (
                        <Link
                          href={`/dashboard/admin/kyc/${v.id}`}
                          className="text-[10px] text-[var(--primary)] hover:underline"
                        >
                          View →
                        </Link>
                      )}
                      {v.id === data.id && (
                        <span className="text-[10px] text-[var(--primary)]">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-5">
          {/* Certifications */}
          <Section title={`Certifications (${certs.length})`}>
            {certs.length === 0 ? (
              <p className="text-xs text-[var(--muted-text)]">
                No certifications uploaded.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {certs.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-[var(--background)] p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        Certification #{i + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(c.status)}`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.url.toLowerCase().endsWith(".pdf") ? (
                      <a
                        href={resolveUrl(c.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] p-4 text-xs text-[var(--primary)] hover:underline"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                          />
                        </svg>
                        View PDF Document
                      </a>
                    ) : (
                      <DocImage
                        src={c.url}
                        alt={`Certification ${i + 1}`}
                        className="w-full aspect-[4/3]"
                      />
                    )}
                    <p className="mt-2 text-[10px] text-[var(--muted-text)]">
                      Uploaded: {formatDate(c.uploadedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* CV Documents */}
          <Section title={`CV Documents (${cvs.length})`}>
            {cvs.length === 0 ? (
              <p className="text-xs text-[var(--muted-text)]">
                No CV documents uploaded.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cvs.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-[var(--background)] p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        CV #{i + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(c.status)}`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.url.toLowerCase().endsWith(".pdf") ? (
                      <a
                        href={resolveUrl(c.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] p-4 text-xs text-[var(--primary)] hover:underline"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                          />
                        </svg>
                        View PDF Document
                      </a>
                    ) : (
                      <DocImage
                        src={c.url}
                        alt={`CV ${i + 1}`}
                        className="w-full aspect-[4/3]"
                      />
                    )}
                    <p className="mt-2 text-[10px] text-[var(--muted-text)]">
                      Uploaded: {formatDate(c.uploadedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {activeTab === "vehicles" && (
        <div className="space-y-5">
          {vehicles.length === 0 ? (
            <Section title="Vehicles">
              <p className="text-xs text-[var(--muted-text)]">
                No vehicles registered for this user.
              </p>
            </Section>
          ) : (
            vehicles.map((v, idx) => (
              <Section
                key={v.id}
                title={`Vehicle ${idx + 1} — ${v.make} ${v.model} (${v.year})`}
              >
                {/* Vehicle Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <InfoCell
                    label="Type"
                    value={
                      v.vehicleType === "OTHER"
                        ? v.otherTypeSpecification || "Other"
                        : v.vehicleType
                    }
                  />
                  <InfoCell label="Make" value={v.make} />
                  <InfoCell label="Model" value={v.model} />
                  <InfoCell label="Year" value={v.year} />
                  <InfoCell label="Color" value={v.color} />
                  <InfoCell label="License Plate" value={v.licensePlate} />
                  <InfoCell label="Capacity" value={v.capacity} />
                  <InfoCell
                    label="Status"
                    value={
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(v.status)}`}
                      >
                        {v.status}
                      </span>
                    }
                  />
                </div>

                {/* Vehicle Photos */}
                <p className="mb-2 text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider">
                  Vehicle Photos
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <p className="mb-1 text-[10px] text-[var(--muted-text)]">
                      Front
                    </p>
                    {v.photoFrontUrl ? (
                      <DocImage
                        src={v.photoFrontUrl}
                        alt="Vehicle Front"
                        className="w-full aspect-[4/3]"
                      />
                    ) : (
                      <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                        <p className="text-[10px] text-[var(--muted-text)]">
                          N/A
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[var(--muted-text)]">
                      Back
                    </p>
                    {v.photoBackUrl ? (
                      <DocImage
                        src={v.photoBackUrl}
                        alt="Vehicle Back"
                        className="w-full aspect-[4/3]"
                      />
                    ) : (
                      <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                        <p className="text-[10px] text-[var(--muted-text)]">
                          N/A
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[var(--muted-text)]">
                      Left
                    </p>
                    {v.photoLeftUrl ? (
                      <DocImage
                        src={v.photoLeftUrl}
                        alt="Vehicle Left"
                        className="w-full aspect-[4/3]"
                      />
                    ) : (
                      <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                        <p className="text-[10px] text-[var(--muted-text)]">
                          N/A
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[var(--muted-text)]">
                      Right
                    </p>
                    {v.photoRightUrl ? (
                      <DocImage
                        src={v.photoRightUrl}
                        alt="Vehicle Right"
                        className="w-full aspect-[4/3]"
                      />
                    ) : (
                      <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                        <p className="text-[10px] text-[var(--muted-text)]">
                          N/A
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[var(--muted-text)]">
                      Vehicle License
                    </p>
                    {v.vehicleLicenseUrl ? (
                      v.vehicleLicenseUrl.toLowerCase().endsWith(".pdf") ? (
                        <a
                          href={resolveUrl(v.vehicleLicenseUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 aspect-[4/3] rounded-lg border border-[var(--border-color)] bg-[var(--surface)] text-xs text-[var(--primary)] hover:underline"
                        >
                          View PDF
                        </a>
                      ) : (
                        <DocImage
                          src={v.vehicleLicenseUrl}
                          alt="Vehicle License"
                          className="w-full aspect-[4/3]"
                        />
                      )
                    ) : (
                      <div className="flex items-center justify-center aspect-[4/3] rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--background)]">
                        <p className="text-[10px] text-[var(--muted-text)]">
                          N/A
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {v.adminNotes && (
                  <div className="mt-3 rounded-lg bg-[var(--background)] p-3">
                    <p className="text-[10px] uppercase text-[var(--muted-text)]">
                      Admin Notes
                    </p>
                    <p className="mt-1 text-sm text-[var(--foreground)]">
                      {v.adminNotes}
                    </p>
                  </div>
                )}
              </Section>
            ))
          )}
        </div>
      )}

      {activeTab === "background" && (
        <Section title="Background Check">
          {data.backgroundCheck ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoCell
                  label="Status"
                  value={
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(data.backgroundCheck.status)}`}
                    >
                      {data.backgroundCheck.status.replace(/_/g, " ")}
                    </span>
                  }
                />
                <InfoCell
                  label="Certificate Number"
                  value={data.backgroundCheck.certificateNumber}
                />
                <InfoCell
                  label="Submitted"
                  value={
                    data.backgroundCheck.submittedAt
                      ? formatDate(data.backgroundCheck.submittedAt)
                      : formatDate(data.backgroundCheck.createdAt)
                  }
                />
              </div>
              {data.backgroundCheck.uploadedDocument && (
                <div>
                  <p className="mb-1.5 text-xs text-[var(--muted-text)]">
                    Uploaded Document
                  </p>
                  {data.backgroundCheck.uploadedDocument
                    .toLowerCase()
                    .endsWith(".pdf") ? (
                    <a
                      href={resolveUrl(data.backgroundCheck.uploadedDocument)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-4 py-3 text-xs text-[var(--primary)] hover:underline"
                    >
                      View PDF Document
                    </a>
                  ) : (
                    <DocImage
                      src={data.backgroundCheck.uploadedDocument}
                      alt="Background Check Document"
                      className="max-w-md aspect-[4/3]"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-text)]">
              No background check submitted for this user.
            </p>
          )}
        </Section>
      )}

      {activeTab === "provider-info" && (
        <ServiceProviderInfoTab data={data} onSaved={fetchDetail} />
      )}

      {/* Review Actions — sticky bottom bar */}
      {isReviewable && (
        <div className="sticky bottom-0 z-10 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 shadow-lg">
          {!reviewAction ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[var(--muted-text)]">
                Review this verification submission
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewAction("APPROVED")}
                  className="rounded-lg bg-[var(--achievement-green)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Approve
                </button>
                <button
                  onClick={() => setReviewAction("REJECTED")}
                  className="rounded-lg bg-[var(--alert-red)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {reviewAction === "APPROVED" ? "Approve" : "Reject"} this
                verification?
              </p>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes (optional)"
                rows={3}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setReviewAction(null);
                    setReviewNotes("");
                  }}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={actionLoading}
                  className={`rounded-lg px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity ${
                    reviewAction === "APPROVED"
                      ? "bg-[var(--achievement-green)]"
                      : "bg-[var(--alert-red)]"
                  }`}
                >
                  {actionLoading
                    ? "Processing..."
                    : `Confirm ${reviewAction === "APPROVED" ? "Approve" : "Reject"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
