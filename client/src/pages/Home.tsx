import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Volume2, BookOpen, Layers, Save, FolderPlus, Languages, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Mock data for analysis
const MOCK_ANALYSIS = {
  sentence: "안녕하세요, 저는 한국어를 공부하고 있어요.",
  pronunciation: "Annyeonghaseyo, jeoneun hangugeoreul gongbuhago isseoyo.",
  words: [
    { korean: "안녕하세요", meaning: "Hello", type: "Greeting" },
    { korean: "저", meaning: "I", type: "Pronoun" },
    { korean: "는", meaning: "Topic particle", type: "Particle" },
    { korean: "한국어", meaning: "Korean language", type: "Noun" },
    { korean: "를", meaning: "Object particle", type: "Particle" },
    { korean: "공부하다", meaning: "To study", type: "Verb" },
    { korean: "고 있다", meaning: "To be doing (Present continuous)", type: "Grammar" }
  ],
  grammar: [
    {
      point: "-는 / -은",
      explanation: "Topic marking particle. Used after a noun to indicate it is the topic of the sentence.",
      example: "저는 (I + topic)"
    },
    {
      point: "-고 있다",
      explanation: "Present continuous tense. Indicates an action is currently in progress.",
      example: "공부하고 있어요 (Am studying)"
    }
  ]
};

const FOLDERS = [
  { id: "travel", name: "Travel ✈️" },
  { id: "cooking", name: "Cooking 🍳" },
  { id: "daily", name: "Daily Life ☀️" },
  { id: "business", name: "Business 💼" },
  { id: "kpop", name: "K-Pop & Drama 🎵" }
];

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<typeof MOCK_ANALYSIS | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const { toast } = useToast();

  const handleAnalyze = () => {
    if (!inputText.trim()) {
      toast({
        title: "Please enter a sentence",
        description: "You need to type a Korean sentence first to analyze it.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    
    // Simulate AI thinking time
    setTimeout(() => {
      setAnalysis(MOCK_ANALYSIS);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleSave = () => {
    if (!selectedFolder) {
      toast({
        title: "Select a folder",
        description: "Please choose a folder theme to save this sentence.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Sentence Saved!",
      description: `Saved to ${FOLDERS.find(f => f.id === selectedFolder)?.name}`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2 text-primary">
            <Languages size={40} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
            K-Lingo AI
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Master Korean pronunciation and grammar through intelligent sentence analysis.
          </p>
        </header>

        {/* Input Section */}
        <Card className="glass-panel border-0 shadow-lg shadow-primary/5 rounded-3xl overflow-hidden">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Textarea 
                placeholder="Enter a Korean sentence here... (e.g., 안녕하세요, 저는 한국어를 공부하고 있어요.)"
                className="min-h-[120px] text-lg resize-none border-0 bg-secondary/20 focus-visible:ring-primary/50 placeholder:text-muted-foreground/60 rounded-2xl p-4"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                data-testid="input-sentence"
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                  className="rounded-xl px-8 h-12 text-md font-semibold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Analyze Sentence
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              <Tabs defaultValue="pronunciation" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/30 p-1 rounded-2xl h-auto">
                  <TabsTrigger value="pronunciation" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all" data-testid="tab-pronunciation">
                    <Volume2 className="w-4 h-4 mr-2" />
                    Pronunciation
                  </TabsTrigger>
                  <TabsTrigger value="words" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all" data-testid="tab-words">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Key Words
                  </TabsTrigger>
                  <TabsTrigger value="grammar" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all" data-testid="tab-grammar">
                    <Layers className="w-4 h-4 mr-2" />
                    Grammar
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  {/* Pronunciation Tab */}
                  <TabsContent value="pronunciation">
                    <Card className="glass-panel border-0 rounded-3xl">
                      <CardHeader>
                        <CardTitle className="flex items-center text-primary">
                          <Volume2 className="w-5 h-5 mr-2" />
                          Listen & Repeat
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-6 bg-primary/5 rounded-2xl">
                          <p className="text-2xl font-medium text-foreground leading-relaxed break-words" data-testid="text-korean-sentence">
                            {analysis.sentence}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Romanization</p>
                          <p className="text-xl text-foreground/80 italic" data-testid="text-romanization">
                            "{analysis.pronunciation}"
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Words Tab */}
                  <TabsContent value="words">
                    <Card className="glass-panel border-0 rounded-3xl">
                      <CardHeader>
                        <CardTitle className="flex items-center text-primary">
                          <BookOpen className="w-5 h-5 mr-2" />
                          Vocabulary Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {analysis.words.map((word, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-white/20 hover:bg-white/80 transition-colors">
                              <div>
                                <p className="text-lg font-bold text-foreground">{word.korean}</p>
                                <p className="text-muted-foreground">{word.meaning}</p>
                              </div>
                              <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground rounded-lg px-3 py-1">
                                {word.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Grammar Tab */}
                  <TabsContent value="grammar">
                    <Card className="glass-panel border-0 rounded-3xl">
                      <CardHeader>
                        <CardTitle className="flex items-center text-primary">
                          <Layers className="w-5 h-5 mr-2" />
                          Grammar Points
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analysis.grammar.map((item, idx) => (
                            <div key={idx} className="p-5 bg-accent/20 rounded-2xl border border-accent/30 space-y-3">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">{item.point}</Badge>
                              </div>
                              <p className="text-foreground leading-relaxed">{item.explanation}</p>
                              <div className="bg-white/60 p-3 rounded-xl border border-white/40">
                                <p className="text-sm text-muted-foreground">Example in sentence:</p>
                                <p className="font-medium">{item.example}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>

              {/* Save to Folder Section */}
              <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl overflow-hidden">
                <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 justify-between">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-display font-bold text-xl flex items-center justify-center sm:justify-start gap-2">
                      <FolderPlus className="w-5 h-5 text-primary" />
                      Save for later
                    </h3>
                    <p className="text-muted-foreground text-sm">Organize your sentences by theme to review them easily.</p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                      <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-xl border-white/50 bg-white" data-testid="select-folder">
                        <SelectValue placeholder="Choose theme..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {FOLDERS.map(folder => (
                          <SelectItem key={folder.id} value={folder.id} className="rounded-lg cursor-pointer">
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      onClick={handleSave} 
                      className="h-12 rounded-xl px-6"
                      data-testid="button-save"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}