import { Brain, Sparkles, Target, TrendingUp, Lightbulb, ArrowRight, Send } from "lucide-react";
import { useState } from "react";

const suggestions = [
  { icon: Target, text: "Set business goals for this quarter", color: "text-primary" },
  { icon: TrendingUp, text: "Review last week's performance", color: "text-primary" },
  { icon: Lightbulb, text: "Help me create a marketing plan", color: "text-primary" },
  { icon: Sparkles, text: "Which apps should I activate?", color: "text-primary" },
];

const recentActivity = [
  { action: "Goal set", detail: "Increase revenue by 20% in Q1", time: "2 hours ago" },
  { action: "App activated", detail: "Docs module is now active", time: "1 day ago" },
  { action: "Task completed", detail: "Review pricing strategy", time: "3 days ago" },
];

export default function BrainDashboard() {
  const [input, setInput] = useState("");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 pt-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 brain-glow mb-4">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Good morning
        </h1>
        <p className="text-muted-foreground text-lg">
          What would you like to work on today?
        </p>
      </div>

      {/* Main AI Input */}
      <div className="relative">
        <div className="rounded-xl border border-border bg-card p-1 card-shadow focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your business..."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
            />
            <button className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0">
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm transition-all hover:bg-secondary hover:border-primary/30 group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <span className="text-secondary-foreground flex-1">{s.text}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Activity
        </h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{item.action}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
