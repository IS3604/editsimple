import "server-only";

/** Server-side configuration. Never import this from a client component. */
export const env = {
  textProvider: (process.env.TEXT_PROVIDER ?? "groq") as "groq" | "openai",
  groqKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini",
  imageProvider: (process.env.IMAGE_PROVIDER ?? "openai") as "openai" | "none",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  youtubeKey: process.env.YOUTUBE_API_KEY ?? "",
  region: process.env.RESEARCH_REGION ?? "IN",
  language: process.env.RESEARCH_LANGUAGE ?? "en",
  wikiUA: process.env.WIKIMEDIA_USER_AGENT ?? "EditSimple/0.1 (contact@example.com)",
  ads: {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    clientId: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    customerId: (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, ""),
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, ""),
    version: process.env.GOOGLE_ADS_API_VERSION ?? "v21",
    geo: process.env.GOOGLE_ADS_GEO_TARGET ?? "2356",
    language: process.env.GOOGLE_ADS_LANGUAGE ?? "1000",
  },
};

export const adsConfigured = () =>
  !!(env.ads.developerToken && env.ads.clientId && env.ads.clientSecret && env.ads.refreshToken && env.ads.customerId);
