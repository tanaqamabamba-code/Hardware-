// localStorage persistence (Firebase sync omitted for now — see firebase-setup.js.disabled for reference)
const LOCAL_KEY = 'tanbuild-state-v1';

export function waitForFirebase(timeoutMs){
  return new Promise((resolve) => {
    if(window.__firebase){ resolve(); return; }
    const onReady = () => { window.removeEventListener('firebase-ready', onReady); resolve(); };
    window.addEventListener('firebase-ready', onReady);
    setTimeout(() => { window.removeEventListener('firebase-ready', onReady); resolve(); }, timeoutMs);
  });
}

export async function loadState(){
  await waitForFirebase(4000);

  if(window.__firebase && window.__firebase.ready){
    try{
      const data = await window.__firebase.getDoc();
      if(data && data.stateJson) return JSON.parse(data.stateJson);
    }catch(e){ console.error('Firebase load failed, falling back to localStorage', e); }
  }

  try{
    const raw = localStorage.getItem(LOCAL_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* no data yet, or localStorage unavailable */ }
  return null;
}

export async function saveState(state){
  let savedRemotely = false;
  let savedLocally = false;

  if(window.__firebase && window.__firebase.ready){
    try{
      await window.__firebase.setDoc({ stateJson: JSON.stringify(state), updatedAt: new Date().toISOString() });
      savedRemotely = true;
    }catch(e){ console.error('Firebase save failed, falling back to localStorage', e); }
  }

  try{
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    savedLocally = true;
  }catch(e){ console.error('localStorage save failed', e); }

  return savedRemotely || savedLocally;
}