import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { ChessKnight } from "@/components/ChessKnight";
import { Shield, TrendingUp, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { SEOHead } from "@/components/SEOHead";

const TOOLS = [
  { key: "riskProfile", icon: Shield, to: "/tools/risk-profile", color: "text-chart-1" },
  { key: "compound", icon: TrendingUp, to: "/tools/compound", color: "text-chart-2" },
  { key: "dca", icon: DollarSign, to: "/tools/dca", color: "text-chart-4" },
] as const;

export default function Tools() {
  const { t } = useLanguage();

  return (
    <>
      <SEOHead
        title="Free Investment Tools"
        description="Discover your investor profile, calculate compound interest, and simulate DCA strategies — all free, no signup required."
        path="/tools"
      />
      <div className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <ChessKnight className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            {t("tools.hero.title" as any)}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t("tools.hero.subtitle" as any)}
          </p>
        </motion.div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TOOLS.map(({ key, icon: Icon, to }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Link to={to}>
                <Card className="h-full group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-lg">
                      {t(`tools.cards.${key}.title` as any)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`tools.cards.${key}.desc` as any)}
                    </p>
                    <div className="flex items-center gap-1 text-sm text-primary font-medium mt-auto">
                      {t("tools.cards.tryIt" as any)}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
