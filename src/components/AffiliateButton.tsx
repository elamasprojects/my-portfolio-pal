import { Button, type ButtonProps } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { buildAffiliateUrl, type AffiliatePlatform } from "@/config/affiliates";

interface AffiliateButtonProps extends Omit<ButtonProps, "onClick"> {
  platform: AffiliatePlatform;
  campaign: string;
  label: string;
}

export function AffiliateButton({ platform, campaign, label, ...props }: AffiliateButtonProps) {
  const url = buildAffiliateUrl(platform, campaign);

  return (
    <Button
      size="lg"
      className="gap-2"
      onClick={() => window.open(url, "_blank", "noopener")}
      {...props}
    >
      {label}
      <ExternalLink className="h-4 w-4" />
    </Button>
  );
}
