/** Doctor & lawyer niches — the client types EditSimple's content team serves. Client-safe. */
import { MARKETS, type MarketCode } from "@/lib/markets";

export type Niche = "medical" | "legal";

export const NICHES: Record<
  Niche,
  {
    label: string;
    who: string;
    clientNoun: string;
    color: string;
    specialties: string[];
    audiences: string[];
    newsQueries: string[];
    youtubeQuery: string;
    formats: string[];
    compliance: string;
    disclaimer: string;
  }
> = {
  medical: {
    label: "Doctors",
    who: "doctor",
    clientNoun: "practice",
    color: "#0F7C72",
    specialties: [
      "General practice / family medicine", "Cardiology", "Dermatology", "Aesthetic medicine", "Obstetrics & gynaecology", "Fertility / IVF", "Paediatrics",
      "Orthopaedics & sports medicine", "Endocrinology & diabetes", "Psychiatry & mental health", "Gastroenterology", "Neurology", "Plastic surgery",
      "Dentistry & orthodontics", "Ophthalmology", "Nutrition & weight management", "Physiotherapy", "Oncology",
    ],
    audiences: ["Adults 30–55 managing their health", "New and expecting parents", "Busy professionals", "Older adults and caregivers", "Women's health seekers", "Active and fitness-minded adults"],
    newsQueries: [
      "\"new study\" health",
      "FDA approval OR CDC OR NHS OR WHO health",
      "disease outbreak OR virus cases",
      "doctors warn",
      "new treatment OR breakthrough medicine",
    ],
    youtubeQuery: "doctor explains",
    formats: [
      "Myth vs fact (busting a common health belief)",
      "Warning signs checklist (when to see a doctor)",
      "What actually happens during a procedure or test",
      "Mistakes patients make with a condition or medicine",
      "News explainer (what this study or outbreak means for you)",
      "Do vs don't for a common situation",
      "Questions to ask your doctor about…",
    ],
    compliance:
      "Educational only. No diagnosis or individual treatment advice, no dosages, no cure or outcome guarantees, no superiority claims, no patient testimonials or identifiable patient details, no fear-mongering. Encourage seeing a qualified clinician for symptoms.",
    disclaimer: "For general education only. Not medical advice.",
  },
  legal: {
    label: "Lawyers",
    who: "lawyer",
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
