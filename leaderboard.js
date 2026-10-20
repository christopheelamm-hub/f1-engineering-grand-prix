// Firebase leaderboard for the existing F1 game.
// Uses browser ES modules; no npm or build tools required.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = {
  apiKey: 'AIzaSyAV_85oKbUiYHLh7S_9oA5twzpby8JqGEk',
  authDomain: 'f1-engineering-gp.firebaseapp.com',
  projectId: 'f1-engineering-gp',
  storageBucket: 'f1-engineering-gp.firebasestorage.app',
  messagingSenderId: '700854551171',
  appId: '1:700854551171:web:e76ebca3aa894919a451b6',
  measurementId: 'G-74CXMPHP38'
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const status = document.getElementById('leaderboardStatus');
const rows = document.getElementById('leaderboardRows');
const circuit = document.getElementById('circuit');
const trackLabel = document.getElementById('leaderboardTrack');
const trackNames = {speed:'Speed Ring',technical:'Technical Circuit',grand:'Grand Prix Circuit'};
// The Firestore rules you published use 'grandprix', while game.js uses 'grand'.
const dbTrack = value => value === 'grand' ? 'grandprix' : value;
let unsubscribe = null;
let authPromise = signInAnonymously(auth);

function format(seconds) {
  const ms = Math.floor(seconds * 1000);
  return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}

function watchScores() {
  if (unsubscribe) unsubscribe();
  const track = circuit.value;
  trackLabel.textContent = trackNames[track] || track;
  status.textContent = 'Loading scores…';
  rows.replaceChildren();
  // No composite index needed: filter by track, sort in browser.
  const q = query(collection(db, 'leaderboard'), where('track', '==', dbTrack(track)));
  unsubscribe = onSnapshot(q, snap => {
    const bestByUid = new Map();
    snap.forEach(doc => {
      const v = doc.data();
      if (typeof v.time !== 'number' || !Number.isFinite(v.time)) return;
      const prev = bestByUid.get(v.uid);
      if (!prev || v.time < prev.time) bestByUid.set(v.uid, v);
    });
    const leaders = [...bestByUid.values()].sort((a,b) => a.time - b.time).slice(0, 20);
    rows.replaceChildren();
    status.textContent = leaders.length ? `${bestByUid.size} driver(s) ranked · Top 20` : 'No scores yet. Be the first!';
    leaders.forEach((v,i) => {
      const line = document.createElement('div');
      line.className = 'leaderboard-row';
      const left = document.createElement('span');
      const right = document.createElement('strong');
      left.textContent = `${i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`} ${v.name}`;
      right.textContent = format(v.time);
      line.append(left,right);
      rows.append(line);
    });
  }, error => { status.textContent = 'Leaderboard unavailable: ' + error.message; });
}

circuit.addEventListener('change', watchScores);
watchScores();

window.addEventListener('f1-race-finished', async event => {
  const {name,track,time} = event.detail;
  if (!Number.isFinite(time) || time <= 5 || time >= 600) {
    status.textContent = 'Lap time outside permitted range; score not submitted.';
    return;
  }
  status.textContent = 'Submitting your best lap…';
  try {
    const user = (await authPromise).user;
    await addDoc(collection(db,'leaderboard'), {
      uid: user.uid,
      name: String(name).trim().slice(0,16) || 'Driver',
      track: dbTrack(track),
      time: time,
      createdAt: serverTimestamp()
    });
    status.textContent = 'Score submitted! Rankings update automatically.';
  } catch (error) {
    status.textContent = 'Could not submit score: ' + error.message;
  }
});
authPromise.catch(error => { status.textContent = 'Sign-in failed: ' + error.message; });
