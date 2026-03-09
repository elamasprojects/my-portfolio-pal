import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ChessKnight } from "@/components/ChessKnight";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  Camera,
  BarChart3,
  Crosshair,
  Sparkles,
  Globe,
  ArrowRight,
  ChevronDown,
  FolderKanban,
  FileSpreadsheet,
  Trophy,
  Users,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { motion } from "motion/react";

const FEATURES = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "tradeEntry", icon: Camera },
  { key: "analysis", icon: BarChart3 },
  { key: "strategy", icon: Crosshair },
  { key: "ai", icon: Sparkles },
  { key: "currency", icon: Globe },
] as const;

const MORE_FEATURES = [
  { key: "portfolios", icon: FolderKanban },
  { key: "csv", icon: FileSpreadsheet },
  { key: "achievements", icon: Trophy },
  { key: "social", icon: Users },
  { key: "discipline", icon: ShieldCheck },
  { key: "reports", icon: Share2 },
] as const;

const STEPS = ["step1", "step2", "step3"] as const;

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <DottedSurface className="pointer-events-none opacity-60" />
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <ChessKnight className="h-12 w-12 text-primary" />
            <span className="font-serif text-4xl font-bold tracking-tight text-foreground">
              Chess
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="font-serif text-5xl md:text-7xl font-bold leading-tight text-foreground"
          >
            {t("landing.hero.tagline")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-xl"
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 mt-2"
          >
            <Button size="lg" className="gap-2 text-base px-8" onClick={() => navigate("/auth")}>
              {t("landing.hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => navigate("/auth")}>
              {t("landing.hero.signIn")}
            </Button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-8 cursor-pointer"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          >
            <div className="flex flex-col items-center gap-2 group">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">
                Descubrí más
              </span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="h-6 w-6 text-primary/60 group-hover:text-primary transition-colors" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ── Features Grid ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-serif text-3xl md:text-4xl font-bold text-center mb-16"
          >
            {t("landing.features.title")}
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ key, icon: Icon }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="h-full group hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {t(`landing.features.${key}.title` as any)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`landing.features.${key}.desc` as any)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-serif text-3xl md:text-4xl font-bold text-center mb-16"
          >
            {t("landing.howItWorks.title")}
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="flex flex-col items-center text-center gap-4"
              >
                <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold font-mono">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  {t(`landing.howItWorks.${step}.title` as any)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`landing.howItWorks.${step}.desc` as any)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── More Features ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-serif text-3xl md:text-4xl font-bold text-center mb-12"
          >
            {t("landing.more.title")}
          </motion.h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {MORE_FEATURES.map(({ key, icon: Icon }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:border-primary/20 transition-colors"
              >
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {t(`landing.more.${key}` as any)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-6"
        >
          <ChessKnight className="h-10 w-10 text-primary" />
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-foreground">
            {t("landing.cta.title")}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("landing.cta.subtitle")}
          </p>
          <Button size="lg" className="gap-2 text-base px-10 mt-2" onClick={() => navigate("/auth")}>
            {t("landing.cta.button")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChessKnight className="h-5 w-5" />
            <span className="text-sm">
              © {new Date().getFullYear()} Chess. {t("landing.footer.rights")}
            </span>
          </div>
          <div className="flex gap-6">
            <button
              onClick={() => navigate("/install")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("landing.footer.install")}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
