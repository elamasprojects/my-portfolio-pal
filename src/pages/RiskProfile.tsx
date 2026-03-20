import { useState } from "react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft, ArrowRight, RotateCcw, Scale, Rocket, Flame } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SEOHead } from "@/components/SEOHead";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Question {
  key: string;
  options: { key: string; score: number }[];
}

const QUESTIONS: Question[] = [
  { key: "horizon", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "lossTolerance", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "experience", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "income", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "goal", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "reaction", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "allocation", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
  { key: "volatility", options: [{ key: "a", score: 1 }, { key: "b", score: 2 }, { key: "c", score: 3 }, { key: "d", score: 4 }] },
];

type ProfileType = "conservative" | "moderate" | "aggressive" | "veryAggressive";

interface ProfileResult {
  type: ProfileType;
  allocation: { name: string; value: number; color: string }[];
}

const PROFILES: Record<string, ProfileResult> = {
  conservative: {
    type: "conservative",
    allocation: [
      { name: "Bonos", value: 60, color: "hsl(var(--chart-3))" },
      { name: "Acciones", value: 25, color: "hsl(var(--chart-1))" },
      { name: "Cash", value: 15, color: "hsl(var(--chart-5))" },
    ],
  },
  moderate: {
    type: "moderate",
    allocation: [
      { name: "Acciones", value: 45, color: "hsl(var(--chart-1))" },
      { name: "Bonos", value: 35, color: "hsl(var(--chart-3))" },
      { name: "ETFs", value: 15, color: "hsl(var(--chart-2))" },
      { name: "Cash", value: 5, color: "hsl(var(--chart-5))" },
    ],
  },
  aggressive: {
    type: "aggressive",
    allocation: [
      { name: "Acciones", value: 55, color: "hsl(var(--chart-1))" },
      { name: "ETFs", value: 25, color: "hsl(var(--chart-2))" },
      { name: "Crypto", value: 15, color: "hsl(var(--chart-4))" },
      { name: "Bonos", value: 5, color: "hsl(var(--chart-3))" },
    ],
  },
  veryAggressive: {
    type: "veryAggressive",
    allocation: [
      { name: "Acciones", value: 40, color: "hsl(var(--chart-1))" },
      { name: "Crypto", value: 30, color: "hsl(var(--chart-4))" },
      { name: "ETFs", value: 25, color: "hsl(var(--chart-2))" },
      { name: "Cash", value: 5, color: "hsl(var(--chart-5))" },
    ],
  },
};

const PROFILE_ICONS: Record<ProfileType, React.ReactNode> = {
  conservative: <Shield className="h-6 w-6" />,
  moderate: <Scale className="h-6 w-6" />,
  aggressive: <Rocket className="h-6 w-6" />,
  veryAggressive: <Flame className="h-6 w-6" />,
};

const PROFILE_GRADIENTS: Record<ProfileType, string> = {
  conservative: "from-blue-500/20 to-cyan-500/10",
  moderate: "from-emerald-500/20 to-teal-500/10",
  aggressive: "from-orange-500/20 to-amber-500/10",
  veryAggressive: "from-red-500/20 to-rose-500/10",
};

function getProfile(score: number): ProfileResult {
  if (score <= 12) return PROFILES.conservative;
  if (score <= 20) return PROFILES.moderate;
  if (score <= 28) return PROFILES.aggressive;
  return PROFILES.veryAggressive;
}

export default function RiskProfile() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);

  const progress = showResult ? 100 : ((step / QUESTIONS.length) * 100);

  const handleAnswer = (score: number) => {
    const newAnswers = [...answers];
    newAnswers[step] = score;
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setShowResult(true);
    }
  };

  const totalScore = answers.reduce((s, v) => s + v, 0);
  const profile = getProfile(totalScore);

  const restart = () => {
    setStep(0);
    setAnswers([]);
    setShowResult(false);
  };

  return (
    <>
      <SEOHead
        title="Investor Risk Profile Test"
        description="Take our free risk profile quiz to discover your investor type and get a personalized portfolio allocation suggestion."
        path="/tools/risk-profile"
      />
      <div className="py-8 px-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="font-serif text-2xl md:text-3xl font-bold">
            {t("tools.riskProfile.title" as any)}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("tools.riskProfile.subtitle" as any)}
        </p>
      </div>

      <Progress value={progress} className="mb-6" />

      <AnimatePresence mode="wait">
        {!showResult ? (
          <motion.div
            key={`q-${step}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {step + 1}. {t(`tools.riskProfile.q.${QUESTIONS[step].key}.text` as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {QUESTIONS[step].options.map((opt) => (
                  <Button
                    key={opt.key}
                    variant={answers[step] === opt.score ? "default" : "outline"}
                    className="justify-start text-left h-auto py-3 px-4 whitespace-normal"
                    onClick={() => handleAnswer(opt.score)}
                  >
                    {t(`tools.riskProfile.q.${QUESTIONS[step].key}.${opt.key}` as any)}
                  </Button>
                ))}

                <div className="flex justify-between mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={step === 0}
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t("common.back" as any)}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {step + 1} / {QUESTIONS.length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Profile header card */}
            <Card className="overflow-hidden">
              <div className={`bg-gradient-to-br ${PROFILE_GRADIENTS[profile.type]} p-6`}>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-background/80 text-primary">
                    {PROFILE_ICONS[profile.type]}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {t("tools.riskProfile.yourProfile" as any) || "Tu perfil"}
                    </p>
                    <h2 className="text-xl font-bold">
                      {t(`tools.riskProfile.result.${profile.type}.title` as any)}
                    </h2>
                  </div>
                </div>
              </div>
              <CardContent className="pt-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`tools.riskProfile.result.${profile.type}.desc` as any)}
                </p>
              </CardContent>
            </Card>

            {/* Portfolio allocation card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("tools.riskProfile.suggestedPortfolio" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={profile.allocation}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="hsl(var(--background))"
                        >
                          {profile.allocation.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-3 flex-1 w-full">
                    {profile.allocation.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link to="/auth">
                  {t("tools.riskProfile.ctaSecondary" as any)}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={restart} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("tools.riskProfile.restart" as any)}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
