/** Client markets. ~90% of EditSimple's clients are outside India. Client-safe. */
export type MarketCode = "US" | "UK" | "CA" | "AU" | "AE" | "SG" | "IN" | "GLOBAL";

export type Market = {
  label: string;
  /** Google News feed params */
  gl: string;
  hl: string;
  ceid: string;
  /** YouTube regionCode */
  yt: string;
  spelling: "US English" | "UK English";
  currency: string;
  /** context the writer should use */
  medicalContext: string;
  legalContext: string;
  /** advertising/compliance norms to respect */
  medicalRules: string;
  legalRules: string;
};

export const MARKETS: Record<MarketCode, Market> = {
  US: {
    label: "United States", gl: "US", hl: "en-US", ceid: "US:en", yt: "US", spelling: "US English", currency: "$",
    medicalContext: "US healthcare (CDC, FDA, insurance and copays, urgent care vs ER)",
    legalContext: "US law — rules vary by state, so say so when it matters",
    medicalRules: "FTC truth-in-advertising: no unsubstantiated claims, no guaranteed results; avoid anything resembling individual medical advice; respect HIPAA (no patient details).",
    legalRules: "ABA Model Rules 7.1–7.3: nothing false or misleading, no promises of outcomes, no direct solicitation. Some states require an 'Attorney Advertising' label — keep posts educational.",
  },
  UK: {
    label: "United Kingdom", gl: "GB", hl: "en-GB", ceid: "GB:en", yt: "GB", spelling: "UK English", currency: "£",
    medicalContext: "UK healthcare (NHS, GP, NICE guidance, 111/A&E)",
    legalContext: "law of England & Wales unless Scotland/NI is specified",
    medicalRules: "GMC guidance and the ASA/CAP Code: factual, verifiable, no exploiting fears, no guaranteed outcomes.",
    legalRules: "SRA Standards and Regulations: not misleading, no unsolicited approaches, no outcome promises.",
  },
  CA: {
    label: "Canada", gl: "CA", hl: "en-CA", ceid: "CA:en", yt: "CA", spelling: "US English", currency: "C$",
    medicalContext: "Canadian healthcare (provincial health plans, family doctor, walk-in clinics)",
    legalContext: "Canadian law — provincial differences matter",
    medicalRules: "Provincial college advertising standards: no testimonials, no superiority claims, factual only.",
    legalRules: "Provincial law society codes: no misleading statements, no outcome guarantees.",
  },
  AU: {
    label: "Australia", gl: "AU", hl: "en-AU", ceid: "AU:en", yt: "AU", spelling: "UK English", currency: "A$",
    medicalContext: "Australian healthcare (Medicare, GP, bulk billing)",
    legalContext: "Australian law — state differences matter",
    medicalRules: "AHPRA advertising rules: no testimonials, no misleading or comparative claims, no creating unreasonable expectations.",
    legalRules: "Legal Profession Uniform Law / state rules: not misleading, no outcome promises.",
  },
  AE: {
    label: "UAE", gl: "AE", hl: "en-AE", ceid: "AE:en", yt: "AE", spelling: "UK English", currency: "AED",
    medicalContext: "UAE healthcare (DHA, DoH Abu Dhabi, MOHAP)",
    legalContext: "UAE federal law and DIFC/ADGM where relevant",
    medicalRules: "Health advertising in the UAE may need regulator approval: stay educational, no claims, no promotions.",
    legalRules: "Stay educational; no claims of results or solicitation.",
  },
  SG: {
    label: "Singapore", gl: "SG", hl: "en-SG", ceid: "SG:en", yt: "SG", spelling: "UK English", currency: "S$",
    medicalContext: "Singapore healthcare (MOH, polyclinics, MediSave)",
    legalContext: "Singapore law",
    medicalRules: "SMC Ethical Code: factual, no testimonials, no laudatory claims.",
    legalRules: "Legal Profession (Publicity) Rules: not false or misleading, no outcome claims.",
  },
  IN: {
    label: "India", gl: "IN", hl: "en-IN", ceid: "IN:en", yt: "IN", spelling: "UK English", currency: "₹",
    medicalContext: "Indian healthcare (AIIMS, ICMR, OPD, private vs government hospitals)",
    legalContext: "Indian law",
    medicalRules: "NMC professional-conduct norms: educational, no self-promotion or claims.",
    legalRules: "Bar Council of India Rule 36: advocates may not advertise or solicit — awareness content only, no 'contact us for your case'.",
  },
  GLOBAL: {
    label: "Global / mixed", gl: "US", hl: "en-US", ceid: "US:en", yt: "US", spelling: "US English", currency: "$",
    medicalContext: "an international audience — avoid country-specific systems or name them explicitly",
    legalContext: "an international audience — explain principles, never one country's statute as if universal",
    medicalRules: "Strictest common standard: factual, no testimonials, no guarantees, no individual advice.",
    legalRules: "Strictest common standard: educational, no solicitation, no outcome promises, note that laws vary by jurisdiction.",
  },
};

export const MARKET_CODES = Object.keys(MARKETS) as MarketCode[];
export const marketOf = (v: string | null | undefined): MarketCode => (v && v in MARKETS ? (v as MarketCode) : "US");
