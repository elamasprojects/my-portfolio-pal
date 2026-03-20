import { useLanguage } from "@/i18n";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Eye, ImageOff, KeyRound, Server } from "lucide-react";
import { motion } from "motion/react";

const sections = [
  { key: "anonymous", icon: Eye },
  { key: "rls", icon: ShieldCheck },
  { key: "encryption", icon: Lock },
  { key: "soc2", icon: Server },
  { key: "ocr", icon: ImageOff },
  { key: "jwt", icon: KeyRound },
] as const;

export default function Security() {
  const { t } = useLanguage();

  return (
    <>
      <SEOHead
        title="Seguridad y Privacidad — Chess"
        description="Conocé cómo protegemos tu información financiera con cifrado, anonimato y certificaciones de seguridad."
        path="/security"
      />
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mx-auto">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
            {t("security.title" as any)}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("security.subtitle" as any)}
          </p>
        </motion.div>

        <div className="grid gap-5">
          {sections.map(({ key, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">
                    {t(`security.${key}.title` as any)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pl-20 pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`security.${key}.desc` as any)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}
