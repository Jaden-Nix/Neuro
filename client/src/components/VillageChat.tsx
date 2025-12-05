import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  MessageCircle, 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  Zap, 
  Target,
  Flame,
  Eye,
  Shield,
  Sparkles,
  Users
} from "lucide-react";

interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  content: string;
  mentions: string[];
  replyTo?: string;
  messageType: "question" | "opinion" | "debate" | "insight" | "reaction" | "callout" | "prediction" | "banter";
  sentiment: "bullish" | "bearish" | "neutral" | "curious" | "excited" | "cautious";
  symbols?: string[];
  timestamp: number;
}

const roleIcons: Record<string, typeof MessageCircle> = {
  hunter: Target,
  analyst: Eye,
  strategist: Zap,
  sentinel: Shield,
  scout: Sparkles,
  veteran: Flame,
};

const roleColors: Record<string, string> = {
  hunter: "text-red-400",
  analyst: "text-blue-400",
  strategist: "text-purple-400",
  sentinel: "text-yellow-400",
  scout: "text-green-400",
  veteran: "text-orange-400",
};

const sentimentColors: Record<string, string> = {
  bullish: "bg-green-500/10 border-green-500/30",
  bearish: "bg-red-500/10 border-red-500/30",
  neutral: "bg-slate-500/10 border-slate-500/30",
  curious: "bg-blue-500/10 border-blue-500/30",
  excited: "bg-yellow-500/10 border-yellow-500/30",
  cautious: "bg-orange-500/10 border-orange-500/30",
};

const messageTypeIcons: Record<string, typeof MessageCircle> = {
  question: HelpCircle,
  opinion: MessageCircle,
  debate: Flame,
  insight: Sparkles,
  reaction: Zap,
  callout: Target,
  prediction: TrendingUp,
  banter: Users,
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function highlightMentions(content: string): JSX.Element {
  const parts = content.split(/(@\w+)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("@")) {
          return (
            <span key={idx} className="text-primary font-semibold">
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

function highlightSymbols(content: string): JSX.Element {
  const symbols = ["BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI", "DOGE", "PEPE", "XRP", "ADA", "DOT", "MATIC", "ATOM", "UNI", "AAVE", "LDO", "CRV", "MKR", "INJ", "TIA", "SEI", "APT", "NEAR", "FTM", "RUNE", "RENDER", "FET", "WLD", "JUP", "PYTH"];
  
  let result = content;
  const elements: JSX.Element[] = [];
  
  let lastIndex = 0;
  const regex = new RegExp(`\\b(${symbols.join("|")})\\b`, "gi");
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    elements.push(
      <span key={`symbol-${match.index}`} className="text-cyan-400 font-mono font-semibold">
        ${match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    elements.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }
  
  return <>{elements.length > 0 ? elements : content}</>;
}

function processContent(content: string): JSX.Element {
  const parts = content.split(/(@\w+)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("@")) {
          return (
            <span key={idx} className="text-primary font-semibold hover:underline cursor-pointer">
              {part}
            </span>
          );
        }
        return <span key={idx}>{highlightSymbols(part)}</span>;
      })}
    </>
  );
}

interface VillageChatProps {
  compact?: boolean;
  maxHeight?: string;
}

export function VillageChat({ compact = false, maxHeight = "500px" }: VillageChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const { data: initialMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/village/chat"],
    refetchInterval: false,
  });

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "village_chat" && data.data) {
          setMessages(prev => {
            const newMessages = [...prev, data.data];
            if (newMessages.length > 100) {
              return newMessages.slice(-80);
            }
            return newMessages;
          });
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    shouldAutoScroll.current = isNearBottom;
  };

  if (compact) {
    return (
      <Card className="p-3 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Users className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-semibold">Village Chat</h3>
          <motion.div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground ml-auto">
            {messages.length} messages
          </span>
        </div>
        
        <ScrollArea className="h-[200px]" ref={scrollRef} onScroll={handleScroll}>
          <div className="space-y-2 pr-2">
            <AnimatePresence mode="popLayout">
              {messages.slice(-10).map((msg, idx) => {
                const RoleIcon = roleIcons[msg.agentRole] || MessageCircle;
                const colorClass = roleColors[msg.agentRole] || "text-muted-foreground";
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs"
                    data-testid={`chat-message-compact-${msg.id}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <RoleIcon className={`w-3 h-3 mt-0.5 shrink-0 ${colorClass}`} />
                      <div className="min-w-0">
                        <span className={`font-semibold ${colorClass}`}>{msg.agentName}</span>
                        <span className="text-muted-foreground">: </span>
                        <span className="text-foreground/90 break-words">
                          {processContent(msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {messages.length === 0 && (
              <div className="text-center py-4">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                </motion.div>
                <p className="text-xs text-muted-foreground">Agents warming up...</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="village-chat">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Users className="w-5 h-5 text-primary" />
          </motion.div>
          <div>
            <h2 className="font-semibold">Trading Village</h2>
            <p className="text-xs text-muted-foreground">Live agent discussions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
          <Badge variant="secondary" className="text-xs">
            {messages.length} msgs
          </Badge>
        </div>
      </div>

      <ScrollArea 
        className="flex-1 p-4" 
        style={{ maxHeight }}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => {
              const RoleIcon = roleIcons[msg.agentRole] || MessageCircle;
              const TypeIcon = messageTypeIcons[msg.messageType] || MessageCircle;
              const colorClass = roleColors[msg.agentRole] || "text-muted-foreground";
              const bgClass = sentimentColors[msg.sentiment] || sentimentColors.neutral;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: idx * 0.02 }}
                  className={`p-3 rounded-lg border ${bgClass} backdrop-blur-sm`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-md bg-background/50 shrink-0 ${colorClass}`}>
                      <RoleIcon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`font-semibold ${colorClass}`}>
                          {msg.agentName}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 gap-1">
                          <TypeIcon className="w-2.5 h-2.5" />
                          {msg.messageType}
                        </Badge>
                        {msg.sentiment === "bullish" && (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        )}
                        {msg.sentiment === "bearish" && (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatTimeAgo(msg.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-foreground/90 leading-relaxed break-words">
                        {processContent(msg.content)}
                      </p>
                      
                      {msg.symbols && msg.symbols.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {msg.symbols.map(symbol => (
                            <Badge 
                              key={symbol} 
                              variant="secondary" 
                              className="text-[10px] font-mono"
                            >
                              ${symbol}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="text-center py-12">
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity }
                }}
              >
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              </motion.div>
              <h3 className="font-medium mb-1">Village is waking up...</h3>
              <p className="text-sm text-muted-foreground">
                AI agents are starting conversations
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
