# Agora Sim Design Guidelines

## Design Approach

**Selected Approach:** Design System + Reference Hybrid
- Primary: Material Design for structured debate components and clear information hierarchy
- Reference: Linear for typography and clean productivity aesthetics, Discord/Twitter for real-time feed patterns
- Rationale: Information-dense platform requiring exceptional readability, clear turn-taking visualization, and real-time content streaming

## Typography System

**Font Family:** Inter (primary), JetBrains Mono (code/technical elements)

**Hierarchy:**
- Debate Arguments: text-base to text-lg, leading-relaxed for optimal readability
- Agent Names/Labels: text-sm font-semibold, uppercase tracking-wide
- Topic Titles: text-2xl to text-4xl font-bold
- UI Labels: text-sm font-medium
- Timestamps/Meta: text-xs text-gray-500

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8 (p-2, p-4, p-6, p-8, etc.)

**Grid Structure:**
- Debate Viewer: Two-column split (70/30) - main debate feed + sidebar for voting/metadata
- Persona Builder: Single column form with max-w-2xl
- Lobby/Topic List: Grid of debate cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Mobile: All layouts collapse to single column stacks

**Container Strategy:**
- Debate room: Full-width with inner max-w-7xl
- Forms/Builders: max-w-2xl centered
- Content sections: max-w-6xl

## Component Library

### Core Debate Components

**Argument Cards:**
- Distinct visual treatment for Agent A vs Agent B (border-l-4 accent)
- Agent avatar/icon on left, name header, argument text, timestamp footer
- Rounded corners (rounded-lg), generous padding (p-6)
- Subtle shadow for depth (shadow-sm)

**Live Feed Container:**
- Scrollable area with auto-scroll to newest argument
- Loading indicators for AI generation states
- Turn indicator showing active agent
- Rounded debate bounds with clear visual separation

**Persona Configuration:**
- Card-based persona preview showing name, tone, bias
- Inline editing with immediate preview updates
- Tag-style bias indicators (rounded-full badges)

### Navigation & Chrome

**Top Navigation:**
- Fixed header with platform logo, active debate indicator, user profile
- Breadcrumb trail for debate context
- Height: h-16

**Debate Sidebar:**
- Sticky voting panel with vote counts
- Spectator count (live)
- Share/embed options
- Related debates suggestions

### Interactive Elements

**Voting Mechanism:**
- Large touch-friendly vote buttons per argument
- Visual feedback showing vote tallies
- Disable after user votes (maintain transparency)

**Real-time Indicators:**
- Pulsing dot for "Agent is typing..."
- Animated entrance for new arguments (slide-in)
- Round progress indicators (1/3, 2/3, 3/3)

### Forms & Input

**Topic Submission:**
- Multi-step form with progress indicator
- Large textarea for topic (min-h-32)
- Dropdown for debate format selection
- Agent configuration inline previews

**Search/Filter:**
- Prominent search bar (w-full max-w-md)
- Filter chips for active debates, completed, by topic category

## Animations

**Use Sparingly:**
- Argument entrance: subtle slide-up (duration-300)
- Vote submission: quick scale feedback (scale-95 to scale-100)
- Agent typing indicator: gentle pulse
- NO scroll-triggered animations, parallax, or decorative motion

## Dark Mode Implementation

**Toggle:** Persistent theme switcher in header (moon/sun icon)
**Strategy:** 
- Use Tailwind dark: variants throughout
- Debate cards: dark:bg-gray-800 with dark:border-gray-700
- Maintain high contrast for text readability (dark:text-gray-100)
- Agent accents remain vibrant in dark mode

## Images

**Minimal Image Usage:**
- Agent avatars: Use generated avatar initials or simple icons (no photos)
- Topic thumbnails: Optional small illustrative icons
- Hero: None - lead directly with active debate feed or topic submission
- Platform is text-first by nature

**Visual Identity:**
- Rely on typography, spacing, and subtle color accents
- Agent differentiation through color-coded borders, not imagery
- Focus remains on argument content clarity

## Page-Specific Layouts

**Debate Room:**
- Full-screen immersive experience with minimal chrome
- Two-column: debate feed (main) + voting sidebar (sticky)
- Fixed header with debate metadata
- Bottom: spectator chat or comment input (collapsible)

**Lobby/Home:**
- Grid of active debate cards with live indicators
- Prominent CTA: "Start New Debate"
- Trending topics section
- Leaderboard sidebar showing top-rated arguments

**Persona Builder:**
- Centered single-column form
- Live preview panel showing how persona will appear in debates
- Save templates for reuse

## Key Principles

1. **Clarity Over Decoration:** Every element serves debate comprehension
2. **Real-time Priority:** Streaming content updates seamlessly without jarring shifts
3. **Turn Visibility:** Always clear whose turn it is and debate progress
4. **Scalability:** Design supports 2-agent debates now, N-agent debates later
5. **Readability First:** Generous line-height, contrast, and whitespace for extended reading