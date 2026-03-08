

## Chess — Your Personal Portfolio Analyst

An AI-powered chat interface where users can ask natural language questions about their portfolio, trades, performance, and get actionable insights.

### What Chess Can Do

The most powerful and useful capabilities, ranked by value:

1. **Portfolio Q&A** — "What's my best performing asset?" / "How much did I invest in crypto?" / "What's my total dividend income?"
2. **Pattern Detection** — "Am I buying high and selling low?" / "Do I trade more on certain days?" / "What's my average holding period?"
3. **Strategy Analysis** — "Which of my strategies has the best win rate?" / "Should I keep doing breakout trades?"
4. **Risk Assessment** — "Am I too concentrated in one asset?" / "What percentage of my portfolio is in one stock?"
5. **Trade Journaling Prompts** — "Summarize my trading week" / "What did I do differently this month vs last month?"
6. **What-If Scenarios** — "If AAPL drops 20%, how does that affect my portfolio?" / "What if I sold all my ETFs today?"

### Architecture

```text
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Chat UI     │────▶│  Edge Function       │────▶│  Lovable AI      │
│  /chess      │     │  chess-chat          │     │  (Gemini 3 Flash)│
│              │◀────│  - fetches user data │◀────│                  │
│  streaming   │     │  - builds context    │     │                  │
└──────────────┘     └─────────────────────┘     └──────────────────┘
```

The edge function fetches the user's trades, holdings, performance, and tags from Supabase, builds a rich system prompt with that data as context, then streams the AI response back.

### Implementation Plan

**Edge Function** `supabase/functions/chess-chat/index.ts`:
- Authenticates the user from the JWT
- Queries the user's trades, portfolios, trade_tags, trade_tag_assignments, discipline_rules, achievements from Supabase using a service-role client
- Computes summary stats server-side (holdings, P&L, allocation) to keep the context compact
- Builds a system prompt that includes: portfolio summary, all trades (capped to last 200), holdings, P&L by symbol, strategy tag breakdown, discipline score
- Streams the response from Lovable AI Gateway (google/gemini-3-flash-preview)
- Handles 429/402 errors gracefully

**Frontend** `src/pages/Chess.tsx`:
- Chat interface with message history (local state, not persisted)
- Message input with send button and Enter key support
- Streaming token-by-token rendering using SSE parsing
- Markdown rendering for AI responses via `react-markdown` (new dep)
- Suggested starter questions as clickable chips: "What's my best trade?", "Am I diversified enough?", "Summarize my portfolio", "Compare my strategies"
- Loading state with typing indicator
- Scrolls to bottom on new messages

**Navigation:**
- Add "Chess AI" to sidebar with a `MessageSquare` icon
- Add `/chess` route to App.tsx

**Config:**
- Update `supabase/config.toml` with `[functions.chess-chat]` and `verify_jwt = false` (validate in code)

### Files

```text
NEW:
  supabase/functions/chess-chat/index.ts  — edge function with data fetching + AI streaming
  src/pages/Chess.tsx                      — chat UI with streaming + markdown

MODIFIED:
  src/components/AppSidebar.tsx            — add Chess AI nav item
  src/App.tsx                              — add /chess route
  supabase/config.toml                     — register chess-chat function

DEPENDENCY:
  react-markdown                           — render AI markdown responses
```

No database changes needed. All context is fetched on-demand per message.

