F1 Engineering GP — V8 Physics and Controls Fix

Upload all five files to the ROOT of the same GitHub repository.
Then open index.html?v=8 and force refresh.

Fixes:
- QUIT RACE stays visible at the top right on mobile during any lap.
- AERO toggles between LOW DRAG and HIGH DOWNFORCE, with visible purple
  active state and an immediate status message.
- Upcoming corners use wider heading samples and much lower safe speeds;
  driving too fast triggers a 1.5–3.2 second off-track incident.
- Tyre wear is scaled to track distance: soft ~99%, medium ~69%,
  hard ~45% after 3 clean laps, with additional wear for overdriving.
- Existing Firebase leaderboard module and track IDs are unchanged.

These are simplified arcade physics, not a calibrated F1 vehicle simulator.
