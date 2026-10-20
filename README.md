Version 11 fixes:
- QUIT RACE is outside the track, below the battery and above status.
- Stops the previous animation frame when quitting or restarting, preventing
  multiple competing race loops after START RACE is pressed again.
- All controls are intentionally inactive between races; START RACE re-enables them.
- AERO toggles on pointerdown (touch and mouse) and keyboard click, with a clear
  purple active state; it resets on quit and restart.
- Proportional corner slowdown, tyres, tracks, and Firebase leaderboard unchanged.
Upload all 5 files to GitHub repository root; open index.html?v=11.
