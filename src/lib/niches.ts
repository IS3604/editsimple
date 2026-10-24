/** Doctor & lawyer niches — the only audiences EditSimple targets. Client-safe. */
export type Niche = "medical" | "legal";

export const NICHES: Record<
  Niche,
  {
    label: string;
    who: string;
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
    color: "#0F7C72",
    specialties: [
      "General physician", "Cardiology", "Dermatology", "Gynaecology & obstetrics", "Paediatrics", "Orthopaedics",
      "Endocrinology & diabetes", "Psychiatry", "Gastroenterology", "Neurology", "ENT", "Dentistry", "Ophthalmology", "Nutrition & dietetics", "Physiotherapy",
    ],
    audiences: ["Patients in their 30s–50s", "New parents", "Working professionals", "Senior citizens & caregivers", "Young women", "Fitness-conscious adults"],
    newsQueries: [
      "health india",
      "disease OR outbreak OR virus india",
      "AIIMS OR ICMR OR \"health ministry\"",
      "\"new study\" health OR medical",
      "doctors patients hospital india",
    ],
    youtubeQuery: "doctor explains",
    formats: [
      "Myth vs fact (busting a common health belief)",
      "Warning signs checklist (when to see a doctor)",
      "What actually happens during a procedure/test",
      "Mistakes patients make with a condition or medicine",
      "Seasonal/news-linked explainer (what this outbreak/study means for you)",
      "Do vs don't for a common situation",
    ],
    compliance:
      "Educational only. No diagnosis or individual treatment advice, no drug dosages, no cure or outcome guarantees, no superiority claims, no patient testimonials, no fear-mongering. Encourage consulting a qualified doctor for symptoms. Keep self-promotion modest (NMC professional-conduct norms).",
    disclaimer: "For awareness only. Not a substitute for medical advice.",
  },
  legal: {
    label: "Lawyers",
    who: "lawyer",
    color: "#8C2F3C",
    specialties: [
      "Family & divorce", "Property & real estate", "Criminal law", "Consumer protection", "Corporate & startup", "Employment & labour",
      "Cyber law & online fraud", "Tax", "Intellectual property", "Civil litigation", "Banking & loan recovery",
    ],
    audiences: ["Salaried professionals", "Startup founders", "Home buyers & tenants", "Couples & families", "Small business owners", "Students & young adults"],
    newsQueries: [
      "\"Supreme Court\" ruling",
      "\"High Court\" judgment",
      "new law OR bill OR amendment india",
      "consumer court OR \"consumer commission\" order",
      "cyber fraud OR scam law india",
    ],
    youtubeQuery: "lawyer explains india",
    formats: [
      "Your rights explained (in a common situation)",
      "What to do if… (step-by-step)",
      "Myth vs law",
      "Landmark/recent judgment explained simply",
      "Mistakes to avoid (in contracts, property, FIRs, etc.)",
      "Do vs don't for a legal situation",
    ],
    compliance:
      "Educational legal awareness only. Advocates in India may not advertise or solicit (Bar Council of India Rule 36): no 'hire me/contact for case' CTAs, no claims of results or being the best, no fee offers. No advice on a specific person's case. Cite laws/sections only when certain; otherwise describe the principle. Mention that facts vary and readers should consult an advocate.",
    disclaimer: "Legal awareness only. Not legal advice — consult an advocate for your case.",
  },
};

export const nicheOf = (v: string | null | undefined): Niche => (v === "legal" ? "legal" : "medical");
