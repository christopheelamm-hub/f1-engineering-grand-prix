# F1 Engineering GP — live leaderboard

Upload `index.html`, `style.css`, `game.js`, and `leaderboard.js` to the ROOT of your GitHub Pages repository.

Firebase project: `f1-engineering-gp`. Enable Anonymous Authentication and use the Firestore rules already configured in your project.

**Track values:** game uses `grand`; Firestore rules allow `grandprix`. `leaderboard.js` maps them.

Scores are submitted after completing three laps. One best time per anonymous Firebase user per circuit is displayed; historical submissions remain in Firestore. Different devices/browsers count as different users.

**Security limitation:** A browser game cannot verify lap times against tampering. This is suitable for a friendly classroom competition, not prize-bearing or high-stakes competition.

After uploading, open your Pages URL with `?v=4` and hard refresh.
