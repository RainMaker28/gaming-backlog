# Gaming Backlog Tracker

Personal gaming backlog tracker with chapter-by-chapter progress tracking.

## Setup

1. Open this folder in VS Code
2. Open the terminal (`Cmd+\``)
3. Run:

```
npm install
npm run dev
```

4. Open `http://localhost:5173/gaming-backlog/` in your browser

## Deploy to GitHub Pages

### First time:

1. Create a new repo on GitHub called `gaming-backlog` (public, empty — no README)
2. In VS Code terminal:

```
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOURUSERNAME/gaming-backlog.git
git branch -M main
git push -u origin main
```

3. Deploy:

```
npm run deploy
```

4. Go to your repo on GitHub → Settings → Pages → Source: "Deploy from a branch" → Branch: `gh-pages` → Save
5. Wait 1-2 minutes, then visit: `https://YOURUSERNAME.github.io/gaming-backlog/`

### Updating:

After making changes, just run:

```
git add .
git commit -m "description of changes"
git push
npm run deploy
```

## Editing games

All game data lives in `src/games.js`. To add a game, add an entry to the array. To add chapters, follow the existing pattern.

## Data

Progress is saved in your browser's localStorage. It persists between sessions but is specific to the browser/device you use.
