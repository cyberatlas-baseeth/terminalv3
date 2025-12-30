# Terminal 🖥️

**Terminal** is a cybersecurity-themed memory game running on the Farcaster platform. Players test their memory to detect fake network nodes and earn **ASLR tokens** for correct guesses.

## 🎮 Game Description

The game is built around a network security scenario. When an unauthorized node is detected in the system, players initiate a memory verification protocol. The goal is to identify the fake number by remembering the displayed numbers.

### Game Flow

1. **Initialization**: System establishes connection and detects an unauthorized node
2. **Number Display**: 6 three-digit numbers are shown on screen for 10 seconds
3. **Selection Phase**: You're asked to find the fake one among 3 numbers
4. **Result**: Correct guess = earn 10 ASLR tokens, wrong guess = game over

### Round System

- Total of **3 rounds**
- New numbers are displayed at the start of each round
- A wrong guess ends the entire game
- Players who complete all rounds earn maximum **30 ASLR tokens**

## 🏆 Leaderboard

Players are ranked by their total earned ASLR tokens. Those with the highest token count appear at the top of the leaderboard.

## ⏱️ Cooldown

- Players can start a new game every **5 minutes**
- This ensures the game remains fair and balanced

## 🛠️ Technical Details

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **Platform**: Farcaster MiniApp
- **Styling**: CSS (Terminal theme)

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── game/          # Game APIs (start, answer)
│   │   ├── leaderboard/   # Leaderboard API
│   │   └── player/        # Player statistics
│   ├── page.tsx           # Main game component
│   ├── layout.tsx         # Application layout
│   └── globals.css        # Global styles
└── lib/
    ├── db.ts              # Database connection
    ├── farcaster.ts       # Farcaster SDK integration
    └── gameLogic.ts       # Game logic and configuration
```

## 🚀 Setup

### Requirements

- Node.js 18+
- PostgreSQL database
- Farcaster account (for testing)

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   DATABASE_URL=postgresql://...
   ```

3. **Create database tables**
   ```sql
   CREATE TABLE players (
     fid INTEGER PRIMARY KEY,
     total_tokens INTEGER DEFAULT 0,
     total_sessions INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE sessions (
     id UUID PRIMARY KEY,
     fid INTEGER REFERENCES players(fid),
     started_at TIMESTAMP DEFAULT NOW(),
     completed_at TIMESTAMP,
     tokens_earned INTEGER DEFAULT 0,
     rounds_completed INTEGER DEFAULT 0
   );
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📝 Game Configuration

Game settings can be modified in `src/lib/gameLogic.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `TOTAL_ROUNDS` | 3 | Total number of rounds |
| `COOLDOWN_MINUTES` | 2 | Cooldown duration (minutes) |
| `TOKENS_PER_CORRECT` | 10 | Tokens per correct answer |
| `MAX_TOKENS_PER_SESSION` | 30 | Maximum tokens per session |

## 🎨 Theme

The game features a retro terminal aesthetic:
- Black background
- Green phosphor text
- Scanline effect
- Glitch animations

## 📄 License

MIT License

---

**Terminal** - Test your memory, find the fake node! 🔍
