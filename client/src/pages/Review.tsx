import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Check, Zap, ArrowLeft, BookOpen, Languages, Layers, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Flashcard } from "@shared/schema";

type CardRating = "again" | "good" | "easy";
type CardFilter = "all" | "sentence" | "vocab" | "grammar";

export default function Review() {
  const [revealed, setRevealed] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<CardFilter>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prevDueIdsRef = useRef<string>("");

  const { data: dueCards = [], isLoading } = useQuery<Flashcard[]>({
    queryKey: ["/api/flashcards/due"],
  });

  const dueIdsKey = dueCards.map(c => c.id).join(",");
  useEffect(() => {
    if (dueIdsKey !== prevDueIdsRef.current) {
      setReviewedIds(new Set());
      prevDueIdsRef.current = dueIdsKey;
    }
  }, [dueIdsKey]);

  const pendingCards = useMemo(
    () => dueCards.filter(c => !reviewedIds.has(c.id) && (filter === "all" || c.cardType === filter)),
    [dueCards, reviewedIds, filter]
  );

  const countByType = useMemo(() => {
    const unreviewed = dueCards.filter(c => !reviewedIds.has(c.id));
    return {
      all: unreviewed.length,
      sentence: unreviewed.filter(c => c.cardType === "sentence").length,
      vocab: unreviewed.filter(c => c.cardType === "vocab").length,
      grammar: unreviewed.filter(c => c.cardType === "grammar").length,
    };
  }, [dueCards, reviewedIds]);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: number; rating: CardRating }) => {
      const res = await apiRequest("POST", `/api/flashcards/${id}/review`, { rating });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setReviewedIds(prev => new Set(prev).add(vars.id));
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/due"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review.", variant: "destructive" });
    },
  });

  const handleRate = (rating: CardRating) => {
    const card = pendingCards[0];
    if (!card) return;
    reviewMutation.mutate({ id: card.id, rating });
    setRevealed(false);
  };

  const card = pendingCards[0];
  const remaining = pendingCards.length;

  const cardTypeIcon = (type: string) => {
    if (type === "sentence") return <Languages className="w-4 h-4" />;
    if (type === "vocab") return <BookOpen className="w-4 h-4" />;
    return <Layers className="w-4 h-4" />;
  };

  const cardTypeLabel = (type: string) => {
    if (type === "sentence") return "Sentence Recall";
    if (type === "vocab") return "Vocabulary";
    return "Grammar";
  };

  const cardTypeColor = (type: string) => {
    if (type === "sentence") return "bg-blue-100 text-blue-700";
    if (type === "vocab") return "bg-emerald-100 text-emerald-700";
    return "bg-purple-100 text-purple-700";
  };

  const tabs: { key: CardFilter; label: string; icon: React.ReactNode; activeClass: string; count: number }[] = [
    { key: "all", label: "All", icon: null, activeClass: "bg-gray-900 text-white", count: countByType.all },
    { key: "sentence", label: "Sentences", icon: <Languages className="w-3.5 h-3.5" />, activeClass: "bg-blue-600 text-white", count: countByType.sentence },
    { key: "vocab", label: "Vocabulary", icon: <BookOpen className="w-3.5 h-3.5" />, activeClass: "bg-emerald-600 text-white", count: countByType.vocab },
    { key: "grammar", label: "Grammar", icon: <Layers className="w-3.5 h-3.5" />, activeClass: "bg-purple-600 text-white", count: countByType.grammar },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="ghost" className="rounded-xl gap-2" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Flashcard Review
          </h1>
          <div className="text-sm text-muted-foreground" data-testid="text-cards-remaining">
            {remaining > 0 ? `${remaining} card${remaining !== 1 ? "s" : ""} left` : ""}
          </div>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-white/60 rounded-2xl shadow-sm" data-testid="filter-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setRevealed(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filter === tab.key
                  ? tab.activeClass + " shadow-sm"
                  : "text-muted-foreground hover:bg-gray-100"
              }`}
              data-testid={`filter-${tab.key}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === tab.key ? "bg-white/20" : "bg-gray-200/80"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : countByType.all === 0 ? (
          <Card className="border-0 rounded-3xl bg-white/80 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2" data-testid="text-no-cards">All caught up!</h2>
              <p className="text-muted-foreground max-w-sm">
                No flashcards due for review right now. Save more sentences to generate new flashcards, or come back later.
              </p>
              <Link href="/">
                <Button className="mt-6 rounded-xl" data-testid="link-go-analyze">
                  Analyze Sentences
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : remaining === 0 ? (
          <Card className="border-0 rounded-3xl bg-white/80 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2" data-testid="text-filter-done">
                No {filter === "all" ? "" : filter} cards left!
              </h2>
              <p className="text-muted-foreground max-w-sm">
                You've reviewed all {filter === "all" ? "" : cardTypeLabel(filter).toLowerCase()} cards. Try another category or come back later.
              </p>
            </CardContent>
          </Card>
        ) : card ? (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cardTypeColor(card.cardType)}`} data-testid="badge-card-type">
                {cardTypeIcon(card.cardType)}
                {cardTypeLabel(card.cardType)}
              </span>
              <span className="text-xs text-muted-foreground">
                Reviewed {card.reviewCount} time{card.reviewCount !== 1 ? "s" : ""}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${card.id}-${revealed}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card
                  className="border-0 rounded-3xl bg-white/90 shadow-xl cursor-pointer min-h-[280px] flex items-center justify-center"
                  onClick={() => !revealed && setRevealed(true)}
                  data-testid="card-flashcard"
                >
                  <CardContent className="flex flex-col items-center justify-center p-10 text-center w-full">
                    {!revealed ? (
                      <>
                        <p className="text-2xl font-medium leading-relaxed break-words" data-testid="text-card-front">
                          {card.frontText}
                        </p>
                        <p className="text-sm text-muted-foreground mt-6">Tap to reveal answer</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          {card.frontText}
                        </p>
                        <div className="w-16 h-px bg-border mb-4" />
                        <p className="text-2xl font-semibold leading-relaxed break-words" data-testid="text-card-back">
                          {card.backText}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center gap-3"
              >
                <Button
                  variant="outline"
                  className="rounded-xl px-6 py-6 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex flex-col gap-1"
                  onClick={() => handleRate("again")}
                  disabled={reviewMutation.isPending}
                  data-testid="button-again"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-xs font-medium">Again</span>
                  <span className="text-[10px] text-muted-foreground">1 day</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl px-6 py-6 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 flex flex-col gap-1"
                  onClick={() => handleRate("good")}
                  disabled={reviewMutation.isPending}
                  data-testid="button-good"
                >
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-medium">Good</span>
                  <span className="text-[10px] text-muted-foreground">3 days</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl px-6 py-6 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 flex flex-col gap-1"
                  onClick={() => handleRate("easy")}
                  disabled={reviewMutation.isPending}
                  data-testid="button-easy"
                >
                  <Zap className="w-5 h-5" />
                  <span className="text-xs font-medium">Easy</span>
                  <span className="text-[10px] text-muted-foreground">7 days</span>
                </Button>
              </motion.div>
            )}

            <div className="flex justify-center">
              <div className="flex gap-1">
                {pendingCards.slice(0, 20).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === 0 ? "bg-primary" : "bg-gray-200"
                    }`}
                  />
                ))}
                {pendingCards.length > 20 && (
                  <span className="text-xs text-muted-foreground ml-1">+{pendingCards.length - 20}</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
