F1 ENGINEERING GP — V9 (QUIT + PROPORTIONAL SPEED PENALTY)

Replace ALL five files in GitHub repository ROOT; commit. Test index.html?v=9.
QUIT RACE now appears inside the track and responds immediately to pointerdown;
works during any lap and resets the race without publishing a leaderboard score.
When above the speed appropriate for an approaching bend, velocity now bleeds
away smoothly in proportion to overspeed, rather than an instant speed cap or
an off-track lockout. Repeated excessive acceleration keeps causing speed loss.
The current status line displays the overspeed and rate of loss.
Tyre wear model and Firestore integration are preserved from v8.
This is an intentionally simplified arcade simulation.
