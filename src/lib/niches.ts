/** Aesthetic-doctor (derm, plastic surgery, med spa) & lawyer niches — the client types EditSimple's content team serves. Client-safe. */
import { MARKETS, type MarketCode } from "@/lib/markets";

export type Niche = "medical" | "legal";

export const NICHES: Record<
  Niche,
  {
    label: string;
    who: string;
    whoPlural: string;
    clientNoun: string;
    color: string;
    specialties: string[];
    audiences: string[];
    newsQueries: string[];
    youtubeQuery: string;
    formats: string[];
    compliance: string;
    disclaimer: string;
    /** Posts aimed at the professionals themselves (B2B): practice owners, not their patients/clients. */
    pro: {
      label: string; // e.g. "Doctors"
      publicLabel: string; // e.g. "Patients"
      who: string;
      audiences: string[];
      newsQueries: string[];
      youtubeQuery: string;
      formats: string[];
      focus: string;
    };
  }
> = {
  medical: {
    label: "Aesthetic doctors",
    who: "dermatology or aesthetic practice (dermatologist, plastic surgeon or med spa)",
    whoPlural: "dermatologists, plastic surgeons, aesthetic practices and med spas",
    clientNoun: "practice",
    color: "#0F7C72",
    specialties: [
      "Dermatology", "Cosmetic dermatology", "Plastic surgery", "Facial plastic surgery", "Aesthetic medicine", "Med spa",
      "Injectables (Botox & fillers)", "Laser & energy-based treatments", "Hair restoration", "Body contouring", "Skin care & acne", "Oculoplastic surgery",
    ],
    audiences: [
      "Adults 25–45 considering cosmetic treatments", "First-time Botox and filler patients", "People with acne, scarring or pigmentation",
      "Adults 40–65 interested in anti-ageing", "Patients researching surgery (rhinoplasty, facelift, breast)", "Men interested in aesthetics and hair loss",
    ],
    newsQueries: [
      "dermatology OR dermatologist",
      "\"plastic surgery\" OR \"plastic surgeon\" OR \"cosmetic surgery\"",
      "\"med spa\" OR medspa OR \"aesthetic clinic\"",
      "Botox OR \"dermal filler\" OR injectables",
      "skincare OR \"skin care\" study OR FDA",
      "laser treatment OR microneedling OR \"hair loss\" treatment",
    ],
    youtubeQuery: "dermatologist explains",
    formats: [
      "Myth vs fact (busting a common skin or cosmetic belief)",
      "What actually happens during a treatment (Botox, filler, laser, surgery)",
      "Recovery and downtime, day by day",
      "Mistakes patients make before or after a treatment",
      "News or trend explainer (a viral skincare trend or new study)",
      "Do vs don't for skin care or aftercare",
      "Questions to ask before choosing an injector or surgeon",
    ],
    compliance:
      "Educational only. No diagnosis or individual treatment advice, no dosages or unit counts as advice, no guaranteed results or 'no downtime' claims, no superiority claims, no before-and-after or patient stories without consent, no body shaming or fear-mongering. Encourage an in-person consultation with a qualified clinician.",
    disclaimer: "For general education only. Not medical advice. Results vary; consult a qualified clinician.",
    pro: {
      label: "Doctors",
      publicLabel: "Patients",
      who: "dermatologists, plastic surgeons, aesthetic doctors, med spa owners and practice managers",
      audiences: [
        "Dermatology practice owners", "Plastic surgeons growing a private practice", "Med spa owners and managers",
        "Aesthetic doctors starting on social media", "Practice managers running marketing", "Cosmetic clinics in a competitive city",
      ],
      newsQueries: [
        "\"med spa\" industry OR \"medical spa\" business",
        "\"aesthetic practice\" OR \"aesthetics industry\"",
        "dermatology practice OR \"dermatology group\"",
        "\"plastic surgery\" practice OR \"cosmetic surgery\" industry",
        "healthcare marketing OR \"patient acquisition\"",
        "Botox OR injectables market OR FDA aesthetic",
      ],
      youtubeQuery: "med spa marketing",
      formats: [
        "Mistakes practices make on social media",
        "What patients actually search before booking",
        "Behind the strategy (how a practice grows with video)",
        "Industry news: what it means for your practice",
        "Checklist for a better consult or patient journey",
        "Myth vs fact about marketing a practice",
        "Do vs don't for advertising compliance",
      ],
      focus:
        "growing the practice: patient acquisition and trust, YouTube and social video, what patients search for, reviews and reputation, consult conversion, patient experience, pricing communication, advertising compliance, industry news and trends",
    },
  },
  legal: {
    label: "Lawyers",
    who: "lawyer",
    whoPlural: "lawyers",
    clientNoun: "firm",
    color: "#8C2F3C",
    specialties: [
      "Personal injury", "Family & divorce", "Immigration", "Employment", "Estate planning & probate", "Real estate & landlord–tenant",
      "Criminal defence", "Business & corporate", "Intellectual property", "Tax", "Bankruptcy & debt", "Consumer protection", "Medical malpractice",
    ],
    audiences: ["Employees and job seekers", "Small business owners and founders", "Tenants and homeowners", "Couples and families", "Immigrants and visa holders", "People planning their estate"],
    newsQueries: [
      "court ruling",
      "\"Supreme Court\" decision",
      "new law OR legislation takes effect",
      "lawsuit settlement consumers",
      "employment law OR tenant rights OR immigration rule",
    ],
    youtubeQuery: "lawyer explains",
    formats: [
      "Your rights explained (in a common situation)",
      "What to do if… (step by step)",
      "Myth vs law",
      "Recent ruling or new law explained simply",
      "Mistakes to avoid (contracts, leases, wills, claims)",
      "Do vs don't for a legal situation",
      "Questions to ask before hiring a lawyer",
    ],
    compliance:
      "Educational legal information only. No advice on a specific person's case, no promised outcomes, no 'best lawyer' or superiority claims, no fee offers, no pressure. Cite statutes only when certain and name the jurisdiction; otherwise explain the principle and note that laws vary.",
    disclaimer: "General information only, not legal advice. Laws vary by location.",
    pro: {
      label: "Lawyers",
      publicLabel: "Clients",
      who: "lawyers, law-firm partners and legal marketers",
      audiences: ["Solo lawyers building a practice", "Law-firm partners", "Legal marketing managers", "Young lawyers growing a personal brand"],
      newsQueries: ["\"law firm\" marketing OR \"legal marketing\"", "\"law firm\" business OR \"legal industry\"", "lawyer advertising rules OR \"bar association\" advertising", "legal technology OR \"legal tech\""],
      youtubeQuery: "law firm marketing",
      formats: [
        "Mistakes law firms make on social media",
        "What clients search before hiring a lawyer",
        "Industry news: what it means for your firm",
        "Do vs don't for lawyer advertising rules",
        "Checklist for a better client intake",
      ],
      focus:
        "growing the firm: client acquisition and trust, video and social content, what clients search for, reviews and reputation, intake and conversion, advertising rules for lawyers, legal-industry news",
    },
  },
};

export const nicheOf = (v: string | null | undefined): Niche => (v === "legal" ? "legal" : "medical");

/** Combined rules for a niche in a market — fed to every prompt. */
export function rulesFor(niche: Niche, market: MarketCode) {
  const m = MARKETS[market];
  return {
    context: niche === "legal" ? m.legalContext : m.medicalContext,
    rules: `${NICHES[niche].compliance} ${niche === "legal" ? m.legalRules : m.medicalRules}`,
    spelling: m.spelling,
    currency: m.currency,
    label: m.label,
  };
}

export type AudienceType = "public" | "pros";
export const audienceTypeOf = (v: unknown): AudienceType => (v === "pros" ? "pros" : "public");

/** The niche as seen for a given audience: posts for patients/clients (default) or for the professionals themselves. */
export function nicheFor(niche: Niche, type: AudienceType) {
  const n = NICHES[niche];
  if (type !== "pros") return { audiences: n.audiences, newsQueries: n.newsQueries, youtubeQuery: n.youtubeQuery, formats: n.formats, readers: n.pro.publicLabel.toLowerCase() };
  return { audiences: n.pro.audiences, newsQueries: n.pro.newsQueries, youtubeQuery: n.pro.youtubeQuery, formats: n.pro.formats, readers: n.pro.who };
}
