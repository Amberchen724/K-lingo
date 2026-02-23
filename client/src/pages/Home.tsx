import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Sparkles, Volume2, BookOpen, Layers, Save, FolderPlus, Languages, Loader2, Trash2, FolderOpen, Edit2, Plus, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface WordEntry {
  korean: string;
  pronunciation: string;
  meaning: string;
  type: string;
}

interface GrammarEntry {
  point: string;
  explanation: string;
  example: string;
}

interface SentenceAnalysis {
  sentence: string;
  translation: string;
  pronunciation: string;
  words: WordEntry[];
  grammar: GrammarEntry[];
}

interface Folder {
  id: number;
  name: string;
  emoji: string;
}

interface SavedSentence {
  id: number;
  korean: string;
  translation: string;
  pronunciation: string;
  words: WordEntry[];
  grammar: GrammarEntry[];
  folderId: number | null;
  createdAt: string;
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [viewingFolder, setViewingFolder] = useState<number | null>(null);
  const [viewingSentence, setViewingSentence] = useState<SavedSentence | null>(null);
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderEmoji, setEditFolderEmoji] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderEmoji, setNewFolderEmoji] = useState("📁");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  const { data: folderSentences = [] } = useQuery<SavedSentence[]>({
    queryKey: ["/api/folders", viewingFolder, "sentences"],
    queryFn: async () => {
      if (!viewingFolder) return [];
      const res = await fetch(`/api/folders/${viewingFolder}/sentences`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: viewingFolder !== null,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { korean: string; translation: string; pronunciation: string; words: WordEntry[]; grammar: GrammarEntry[]; folderId: number }) => {
      const res = await apiRequest("POST", "/api/sentences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      if (viewingFolder) {
        queryClient.invalidateQueries({ queryKey: ["/api/folders", viewingFolder, "sentences"] });
      }
      toast({ title: "Sentence Saved!", description: `Saved to ${folders.find(f => f.id.toString() === selectedFolder)?.emoji} ${folders.find(f => f.id.toString() === selectedFolder)?.name}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save sentence", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sentences/${id}`);
    },
    onSuccess: () => {
      if (viewingFolder) {
        queryClient.invalidateQueries({ queryKey: ["/api/folders", viewingFolder, "sentences"] });
      }
      if (viewingSentence) setViewingSentence(null);
      toast({ title: "Deleted", description: "Sentence removed from folder" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; emoji: string }) => {
      const res = await apiRequest("POST", "/api/folders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNewFolderEmoji("📁");
      toast({ title: "Folder Created", description: "Your new theme is ready!" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name, emoji }: { id: number; name: string; emoji: string }) => {
      const res = await apiRequest("PATCH", `/api/folders/${id}`, { name, emoji });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setEditingFolder(null);
      toast({ title: "Folder Updated", description: "Changes saved successfully." });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setViewingFolder(null);
      toast({ title: "Folder Deleted", description: "The folder and its sentences were removed." });
    },
  });

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast({ title: "Please enter a sentence", description: "You need to type a Korean sentence first to analyze it.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await apiRequest("POST", "/api/analyze", { sentence: inputText.trim() });
      const data: SentenceAnalysis = await res.json();
      setAnalysis(data);
    } catch (error) {
      toast({ title: "Analysis failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!selectedFolder) {
      toast({ title: "Select a folder", description: "Please choose a folder theme to save this sentence.", variant: "destructive" });
      return;
    }
    if (!analysis) return;

    saveMutation.mutate({
      korean: analysis.sentence,
      translation: analysis.translation,
      pronunciation: analysis.pronunciation,
      words: analysis.words,
      grammar: analysis.grammar,
      folderId: parseInt(selectedFolder),
    });
  };

  const handleSpeak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Failed to fetch audio");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      toast({
        title: "Audio error",
        description: "Failed to play native speaker audio.",
        variant: "destructive"
      });
    }
  };

  const renderAnalysis = (data: SentenceAnalysis) => (
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
        <TabsContent value="pronunciation">
          <Card className="glass-panel border-0 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center text-primary">
                <Volume2 className="w-5 h-5 mr-2" />
                Listen & Repeat
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-xl text-primary hover:bg-primary/10"
                onClick={() => handleSpeak(data.sentence)}
                data-testid="button-speak"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Play Audio
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="p-6 bg-primary/5 rounded-2xl cursor-pointer hover:bg-primary/10 transition-colors group relative"
                onClick={() => handleSpeak(data.sentence)}
              >
                <p className="text-2xl font-medium text-foreground leading-relaxed break-words pr-8" data-testid="text-korean-sentence">
                  {data.sentence}
                </p>
                <p className="text-lg text-muted-foreground mt-2" data-testid="text-translation">
                  {data.translation}
                </p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                  <Volume2 className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Romanization</p>
                <p className="text-xl text-foreground/80 italic" data-testid="text-romanization">
                  "{data.pronunciation}"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                {data.words.map((word, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-white/20 hover:bg-white/80 transition-colors" data-testid={`word-entry-${idx}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-foreground">{word.korean}</p>
                        <p className="text-sm text-muted-foreground italic">({word.pronunciation})</p>
                      </div>
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
                {data.grammar.map((item, idx) => (
                  <div key={idx} className="p-5 bg-accent/20 rounded-2xl border border-accent/30 space-y-3" data-testid={`grammar-point-${idx}`}>
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
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

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

        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              {renderAnalysis(analysis)}

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
                        {folders.map(folder => (
                          <SelectItem key={folder.id} value={folder.id.toString()} className="rounded-lg cursor-pointer">
                            {folder.emoji} {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="h-12 rounded-xl px-6"
                      data-testid="button-save"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            My Saved Sentences
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {folders.map(folder => (
              <div key={folder.id} className="relative group">
                {editingFolder === folder.id ? (
                  <div className="p-3 bg-white border border-primary/30 rounded-2xl space-y-2 z-10 shadow-lg">
                    <div className="flex gap-2">
                      <Input 
                        value={editFolderEmoji} 
                        onChange={(e) => setEditFolderEmoji(e.target.value)}
                        className="w-12 text-center p-0 h-9 rounded-lg"
                      />
                      <Input 
                        value={editFolderName} 
                        onChange={(e) => setEditFolderName(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingFolder(null)} className="h-8 w-8 p-0">
                        <X className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={() => updateFolderMutation.mutate({ id: folder.id, name: editFolderName, emoji: editFolderEmoji })} className="h-8 w-8 p-0">
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setViewingFolder(viewingFolder === folder.id ? null : folder.id);
                        setViewingSentence(null);
                      }}
                      className={`w-full p-4 rounded-2xl text-center transition-all hover:scale-[1.02] ${
                        viewingFolder === folder.id
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-white/60 hover:bg-white/80 border border-white/30"
                      }`}
                      data-testid={`folder-${folder.id}`}
                    >
                      <span className="text-2xl block mb-1">{folder.emoji}</span>
                      <span className="text-sm font-semibold">{folder.name}</span>
                    </button>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 bg-white/90 shadow-sm rounded-lg hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolder(folder.id);
                          setEditFolderName(folder.name);
                          setEditFolderEmoji(folder.emoji);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 bg-white/90 shadow-sm rounded-lg hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this folder and all sentences inside?")) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {isCreatingFolder ? (
              <div className="p-3 bg-white border border-primary/30 rounded-2xl space-y-2 shadow-lg">
                <div className="flex gap-2">
                  <Input 
                    value={newFolderEmoji} 
                    onChange={(e) => setNewFolderEmoji(e.target.value)}
                    className="w-12 text-center p-0 h-9 rounded-lg"
                    placeholder="📁"
                  />
                  <Input 
                    value={newFolderName} 
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="h-9 rounded-lg"
                    placeholder="Theme..."
                    autoFocus
                  />
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)} className="h-8 w-8 p-0">
                    <X className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    disabled={!newFolderName.trim()}
                    onClick={() => createFolderMutation.mutate({ name: newFolderName, emoji: newFolderEmoji })} 
                    className="h-8 w-8 p-0"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="p-4 rounded-2xl text-center border-2 border-dashed border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <Plus className="w-6 h-6 mx-auto mb-1 text-primary/40 group-hover:text-primary/60" />
                <span className="text-sm font-semibold text-primary/40 group-hover:text-primary/60">New Folder</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {viewingFolder && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {folderSentences.length === 0 ? (
                  <Card className="border-0 bg-white/40 rounded-2xl">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No sentences saved in this folder yet. Analyze a sentence above and save it here!
                    </CardContent>
                  </Card>
                ) : (
                  folderSentences.map(s => (
                    <Card
                      key={s.id}
                      className={`border-0 rounded-2xl cursor-pointer transition-all hover:shadow-md ${
                        viewingSentence?.id === s.id ? "bg-primary/5 shadow-md" : "bg-white/60"
                      }`}
                      data-testid={`saved-sentence-${s.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0" onClick={() => setViewingSentence(viewingSentence?.id === s.id ? null : s)}>
                            <p className="text-lg font-medium truncate">{s.korean}</p>
                            <p className="text-sm text-muted-foreground truncate">{s.translation}</p>
                            <p className="text-xs text-muted-foreground italic truncate">{s.pronunciation}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }}
                            data-testid={`delete-sentence-${s.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {viewingSentence && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {renderAnalysis({
                  sentence: viewingSentence.korean,
                  pronunciation: viewingSentence.pronunciation,
                  words: viewingSentence.words,
                  grammar: viewingSentence.grammar,
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
