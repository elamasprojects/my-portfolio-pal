export const AFFILIATE_LINKS = {
  bingx: "https://bingx.com/invite/chess",
  cocos: "https://cocos.capital",
} as const;

export type AffiliatePlatform = keyof typeof AFFILIATE_LINKS;

export function buildAffiliateUrl(
  platform: AffiliatePlatform,
  campaign: string
): string {
  const base = AFFILIATE_LINKS[platform];
  const params = new URLSearchParams({
    utm_source: "chess",
    utm_medium: "tool",
    utm_campaign: campaign,
  });
  return `${base}?${params.toString()}`;
}
