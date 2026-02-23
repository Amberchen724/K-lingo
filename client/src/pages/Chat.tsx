import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MessageSquare, Plus, Trash2, Send, Loader2, Bot, User, ChevronLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export default function Chat() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: () => apiRequest("GET", "/api/conversations").then((r) => r.json()),
  });

  const { data: activeConversation, isLoading: loadingMessages } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/conversations", activeConversationId],
    queryFn: () =>
      apiRequest("GET", `/api/conversations/${activeConversationId}`).then((r) => r.json()),
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (activeConversation) {
      setMessages(activeConversation.messages);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const createConversation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/conversations", { title: "New Chat" }).then((r) => r.json()),
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(conv.id);
      setMessages([]);
    },
    onError: () => {
      toast({ title: "Failed to create conversation", variant: "destructive" });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/conversations/${id}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete conversation", variant: "destructive" });
    },
  });

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !activeConversationId) return;

    const userMessage: Message = {
      id: Date.now(),
      conversationId: activeConversationId,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to send message");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              const assistantMessage: Message = {
                id: Date.now() + 1,
                conversationId: activeConversationId,
                role: "assistant",
                content: fullContent,
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent("");
              queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId] });
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
            } else if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      toast({ title: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSelectConversation = (id: number) => {
    if (id === activeConversationId) return;
    setActiveConversationId(id);
    setMessages([]);
    setStreamingContent("");
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white overflow-hidden">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-72 flex-shrink-0 flex flex-col border-r border-white/10 bg-white/5 backdrop-blur-sm"
            data-testid="sidebar"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors" data-testid="link-home">
                <ChevronLeft size={16} />
                K-Lingo
              </Link>
              <Button
                size="sm"
                onClick={() => createConversation.mutate()}
                disabled={createConversation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white border-0 h-8 px-3"
                data-testid="button-new-chat"
              >
                {createConversation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span className="ml-1 text-xs">New Chat</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-purple-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm px-4">
                  No conversations yet. Start a new chat!
                </div>
              ) : (
                conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      activeConversationId === conv.id
                        ? "bg-purple-600/40 text-white"
                        : "hover:bg-white/10 text-white/70 hover:text-white"
                    }`}
                    onClick={() => handleSelectConversation(conv.id)}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    <MessageSquare size={14} className="flex-shrink-0 opacity-60" />
                    <span className="flex-1 text-sm truncate">{conv.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-conversation-${conv.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-white/60 hover:text-white transition-colors"
            data-testid="button-toggle-sidebar"
          >
            <MessageSquare size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <span className="font-semibold text-white/90">AI Assistant</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4" data-testid="messages-container">
          {!activeConversationId ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center">
                <Bot size={32} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">How can I help you?</h2>
                <p className="text-white/50 text-sm max-w-xs">
                  Start a new conversation to chat with the AI assistant.
                </p>
              </div>
              <Button
                onClick={() => createConversation.mutate()}
                disabled={createConversation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white border-0"
                data-testid="button-start-chat"
              >
                {createConversation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Plus size={16} className="mr-2" />
                )}
                Start a conversation
              </Button>
            </div>
          ) : loadingMessages && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-purple-400" />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Bot size={32} className="text-purple-400/60" />
              <p className="text-white/40 text-sm">Send a message to begin</p>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user"
                          ? "bg-purple-600"
                          : "bg-white/10 border border-white/20"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User size={15} />
                      ) : (
                        <Bot size={15} className="text-purple-300" />
                      )}
                    </div>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-purple-600 text-white rounded-tr-sm"
                          : "bg-white/10 text-white/90 rounded-tl-sm"
                      }`}
                      data-testid={`message-content-${msg.id}`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isStreaming && streamingContent && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                  data-testid="message-streaming"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/20">
                    <Bot size={15} className="text-purple-300" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-white/10 text-white/90">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
                  </div>
                </motion.div>
              )}

              {isStreaming && !streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/20">
                    <Bot size={15} className="text-purple-300" />
                  </div>
                  <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {activeConversationId && (
          <div className="px-4 py-4 border-t border-white/10 bg-white/5 backdrop-blur-sm flex-shrink-0">
            <div className="flex gap-3 items-end max-w-4xl mx-auto">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl min-h-[44px] max-h-32"
                data-testid="input-message"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="bg-purple-600 hover:bg-purple-500 text-white border-0 h-11 w-11 p-0 rounded-xl flex-shrink-0"
                data-testid="button-send"
              >
                {isStreaming ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
