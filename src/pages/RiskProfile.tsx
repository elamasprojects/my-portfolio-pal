import { useState } from "react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AffiliateButton } from "@/components/AffiliateButton";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {t(`tools.riskProfile.result.${profile.type}.title` as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  {t(`tools.riskProfile.result.${profile.type}.desc` as any)}
                </p>

                {/* Pie Chart */}
                <div>
                  <h4 className="font-medium mb-3">
                    {t("tools.riskProfile.suggestedPortfolio" as any)}
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={profile.allocation}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name} ${value}%`}
                        >
                          {profile.allocation.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-3 pt-4 border-t border-border">
                  <AffiliateButton
                    platform="bingx"
                    campaign="risk-profile"
                    label={t("tools.riskProfile.cta" as any)}
                  />
                  <Button variant="outline" asChild>
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
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
