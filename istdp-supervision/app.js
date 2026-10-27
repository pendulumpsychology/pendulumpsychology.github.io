'use strict';
// Supervision roster app. Talks to the roster server at window.ROSTER_API (set in config.js).
// One phone can belong to several groups: it keeps one device token per group.

const API = String(window.ROSTER_API || '').replace(/\/$/, '');
const K_DEVICES = 'roster.devices';     // { groupId: deviceToken }
const K_CURRENT = 'roster.current';     // groupId shown now
const K_ADMIN = 'roster.admin';         // { groupId: adminToken }
const K_ADMIN_ASKED = 'roster.adminAsked'; // { groupId: 1 } = said "no thanks" to being admin
const K_SKIP_INSTALL = 'roster.skipInstall';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  obj(k) { try { return JSON.parse(this.get(k) || '{}') || {}; } catch (e) { return {}; } },
  setObj(k, o) { this.set(k, JSON.stringify(o)); },
};

// What the page can tell about where it's running.
const UA = navigator.userAgent;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; // opened from the home-screen icon
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const isAndroid = /Android/i.test(UA);
const OS = isIOS ? 'ios' : isAndroid ? 'android' : 'computer';
const iosVersion = (() => { const m = UA.match(/OS (\d+)_(\d+)/); return m ? Number(m[1]) + Number(m[2]) / 100 : null; })();
const iosTooOld = isIOS && iosVersion !== null && iosVersion < 16.04; // web push on iPhone needs iOS 16.4+
// In-app browsers (opened from a link in Messenger, Instagram, Gmail etc.) can't add to the home screen.
const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Snapchat|MicroMessenger|GSA\/|\bwv\)/.test(UA);
const iosBrowser = !isIOS ? null : /CriOS/.test(UA) ? 'Chrome' : /FxiOS/.test(UA) ? 'Firefox' : /EdgiOS/.test(UA) ? 'Edge' : 'Safari';
const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const el = document.getElementById('app');
let devices = store.obj(K_DEVICES);
let adminTokens = store.obj(K_ADMIN);
let adminAsked = store.obj(K_ADMIN_ASKED);
let current = store.get(K_CURRENT);
if (!devices[current]) current = Object.keys(devices)[0] || null;

let state = null;          // member's view of the current group
let groupNames = {};       // groupId -> name, for the switcher
let adminState = null;
let adminGroup = null;     // groupId being administered

// Joining flow: 'groups' -> ('create') -> 'ask' -> 'new' | 'pick'
let joining = !current;
let step = 'groups';
let groupList = null;
let joinGroup = null;      // { id, name }
let memberList = null;

let notifyStep = false;    // show the notifications step right after signing up
let openPanel = null;      // which inline form is open: 'add' | 'edit-<id>' | 'admin-yes'
let flash = null;
let busy = false;
let installEvent = null;

// ---------------------------------------------------------------- helpers

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function say(text, kind) { flash = text ? { text, kind: kind || 'notice' } : null; }

function saveDevices() { store.setObj(K_DEVICES, devices); }
function setCurrent(gid) { current = gid ? String(gid) : null; if (current) store.set(K_CURRENT, current); else store.del(K_CURRENT); }
function saveAdminToken(gid, token) {
  if (token) adminTokens[gid] = token; else delete adminTokens[gid];
  store.setObj(K_ADMIN, adminTokens);
}

function forgetGroup(gid) {
  delete devices[gid];
  saveDevices();
  delete groupNames[gid];
  if (String(current) === String(gid)) {
    setCurrent(Object.keys(devices)[0] || null);
    state = null;
  }
  if (!current) { joining = true; step = 'groups'; }
}

async function api(path, body, opts = {}) {
  const headers = { 'X-Standalone': standalone ? '1' : '0' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const devToken = opts.token !== undefined ? opts.token : (current && devices[current]);
  if (devToken) headers['X-Device'] = devToken;
  if (opts.admin) headers['X-Admin'] = adminTokens[adminGroup] || '';
  let res;
  try {
    res = await fetch(`${API}/api/${path}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Can\'t reach the roster server. Check your internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.code === 'signed_out' && devToken) {
    const gid = Object.keys(devices).find((k) => devices[k] === devToken);
    if (gid) forgetGroup(gid);
  }
  if (res.status === 401 && data.code === 'admin_login' && opts.admin) {
    saveAdminToken(adminGroup, null);
    adminState = null;
  }
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (${res.status}).`);
    err.code = data.code;
    throw err;
  }
  return data;
}

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isAdminView = () => location.hash.startsWith('#admin');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function load() {
  if (isAdminView()) {
    if (!adminGroup) adminGroup = current || null;
    if (adminGroup && adminTokens[adminGroup]) adminState = await api('admin/state', undefined, { admin: true });
    else groupList = (await api('groups', undefined, { token: null })).groups;
    return;
  }
  if (!joining && current) {
    state = await api('state');
    groupNames[current] = state.group.name;
  }
}

// Run an action, show its message, reload, re-render.
async function act(fn, { closePanel = true } = {}) {
  if (busy) return;
  busy = true;
  render();
  let ok = true;
  try {
    const msg = await fn();
    if (msg) say(msg, 'notice');
  } catch (e) {
    ok = false;
    say(e.message, 'warn');
  }
  if (ok && closePanel) openPanel = null;
  try { await load(); } catch (e) { if (!flash) say(e.message, 'warn'); }
  busy = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refresh() {
  try { await load(); } catch (e) { say(e.message, 'warn'); }
  render();
  if (state) syncPush();
}

async function loadGroupNames() {
  for (const gid of Object.keys(devices)) {
    if (groupNames[gid]) continue;
    try {
      const s = await api('state', undefined, { token: devices[gid] });
      groupNames[gid] = s.group.name;
    } catch (e) { /* signed out ones are removed by api() */ }
  }
  render();
}

// ---------------------------------------------------------------- notifications

function pushStatus() {
  if (!pushSupported) return (isIOS && !standalone) ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (state && state.device.push && Notification.permission === 'granted') return 'on';
  return 'off';
}

// This browser has one push subscription; register it for every group this phone is in.
async function shareSubscription(sub) {
  const json = sub.toJSON();
  for (const gid of Object.keys(devices)) {
    try { await api('subscribe', json, { token: devices[gid] }); } catch (e) { /* ignore */ }
  }
}

async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return perm === 'denied'
      ? 'Notifications were blocked. You can turn them on later in your phone\'s settings for this app.'
      : 'Notifications weren\'t turned on.';
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(state.vapidPublicKey) });
  await shareSubscription(sub);
  return 'Notifications are on for this device.';
}

// Quietly keeps the server's copy of this browser's subscription current.
async function syncPush() {
  if (!pushSupported || Notification.permission !== 'granted' || !state) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const expired = state.device.pushError && /expired/i.test(state.device.pushError);
    if (sub && expired) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(state.vapidPublicKey) });
    const wasOff = !state.device.push;
    await shareSubscription(sub);
    if (wasOff) { state = await api('state'); render(); }
  } catch (e) {
    // Leave the "Turn on notifications" button showing.
  }
}

// ---------------------------------------------------------------- views

function render() {
  if (!API || API.includes('CHANGE-ME')) {
    el.innerHTML = `<header class="top"><h1>Supervision roster</h1></header>
      <div class="card warn">The server address hasn't been set yet. Edit <code>config.js</code> in this folder (setup guide, step 5).</div>`;
    return;
  }
  if (isAdminView()) { el.innerHTML = adminView(); return; }
  if (joining) {
    // On a phone, set up the home-screen app before signing up, unless the page is already running as it.
    const needsInstall = OS !== 'computer' && !standalone && !store.get(K_SKIP_INSTALL);
    el.innerHTML = needsInstall ? installView() : joinView();
    return;
  }
  if (!state) { el.innerHTML = '<div class="spinner" aria-label="Loading"></div>'; return; }
  el.innerHTML = (notifyStep && pushStatus() === 'off') ? notifyStepView() : mainView();
}

function flashHtml() {
  if (!flash) return '';
  return `<div class="flash card ${flash.kind === 'warn' ? 'warn' : 'notice'}" role="status">${esc(flash.text)}</div>`;
}

const SHARE_ICON = `<svg class="share-icon" width="18" height="20" viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="1.8" aria-label="Share icon"><path d="M9 14V2M5 6l4-4 4 4"/><path d="M4 9H2v11h14V9h-2"/></svg>`;

const MENU_ICON = '<strong aria-label="menu">⋮</strong>';

// Shown on a phone before signing up, when the page is open in the browser rather than from the home-screen icon.
function installView() {
  const head = '<header class="top"><h1>Supervision roster</h1></header>';
  const already = `<p class="muted small">Already added it? Close this and open <strong>Supervision</strong> from your home screen instead.</p>`;

  if (inAppBrowser) {
    return `${head}<div class="card warn">
      <h3 style="margin-top:0">Open this in ${isIOS ? 'Safari' : 'Chrome'} first</h3>
      <p>This page has opened inside another app (for example from a message or email link). That app can't add it to your home screen.</p>
      <ol class="steps">
        <li>Look for a <strong>⋯</strong> or ${MENU_ICON} menu, or a compass icon, near the top or bottom of the screen.</li>
        <li>Choose <strong>Open in ${isIOS ? 'Safari' : 'Chrome'}</strong> (it may say <strong>Open in browser</strong>).</li>
      </ol>
      <p>If you can't find it, copy this address into ${isIOS ? 'Safari' : 'Chrome'}:<br><strong>${esc(location.origin + location.pathname)}</strong></p>
    </div>`;
  }

  if (isIOS) {
    const where = iosBrowser === 'Safari'
      ? `Tap the Share button ${SHARE_ICON}. It's in the toolbar at the bottom of Safari (on iPad, at the top).`
      : `Tap the Share button ${SHARE_ICON}. In ${iosBrowser} it's at the top right, next to the address bar.`;
    return `${head}
      ${iosTooOld ? `<div class="card warn"><strong>Your iPhone needs an update for notifications.</strong> Notifications need iOS 16.4 or later; this iPhone has iOS ${String(iosVersion).replace('.', '.')}. Update in Settings → General → Software Update, then come back. You can still set up the app now.</div>` : ''}
      <div class="card">
        <h3 style="margin-top:0">First, add this to your home screen</h3>
        <p>On iPhone, notifications only work from the home-screen app, and it saves you finding this link again. It takes four taps:</p>
        <ol class="steps">
          <li>${where}</li>
          <li>Scroll down the list and tap <strong>Add to Home Screen</strong>. (If you don't see it, tap <strong>Edit Actions</strong> at the bottom of the list and add it.)</li>
          <li>Tap <strong>Add</strong> at the top right.</li>
          <li>Close ${iosBrowser} and tap the new <strong>Supervision</strong> icon on your home screen. You'll sign up there.</li>
        </ol>
        <p class="muted small">Please don't sign up here in ${iosBrowser} first: iPhone keeps the home-screen app separate, so you'd have to do it twice.</p>
        ${already}
      </div>
      <p class="center"><button class="link small" data-act="skip-install">Skip: use it in ${iosBrowser} without notifications</button></p>`;
  }

  // Android
  const oneTap = installEvent
    ? `<p><button class="primary big" data-act="install">Add to home screen</button></p>
       <p class="small muted">Then tap <strong>Install</strong> (or <strong>Add</strong>) when asked.</p>`
    : '';
  return `${head}<div class="card">
      <h3 style="margin-top:0">First, add this to your home screen</h3>
      <p>It saves you finding this link again, and makes notifications more reliable.</p>
      ${oneTap}
      ${installEvent ? '<p class="small muted" style="margin-bottom:0">Or do it from the browser menu:</p>' : ''}
      <ol class="steps">
        <li>Tap the menu ${MENU_ICON} at the top right of Chrome (in Samsung Internet, the ☰ menu at the bottom right).</li>
        <li>Tap <strong>Add to home screen</strong> or <strong>Install app</strong>.</li>
        <li>Tap <strong>Install</strong> or <strong>Add</strong>.</li>
        <li>Close the browser and tap the new <strong>Supervision</strong> icon on your home screen. You'll sign up there.</li>
      </ol>
      ${already}
    </div>
    <p class="center"><button class="link small" data-act="skip-install">Skip: sign up in the browser</button></p>`;
}

// Straight after signing up: one screen for notifications before the roster.
function notifyStepView() {
  return `<header class="top"><div><div class="muted small">Supervision roster</div><h1>${esc(state.group.name)}</h1></div><span class="who">${esc(state.me.name)}</span></header>
    ${flashHtml()}
    <div class="card">
      <h3 style="margin-top:0">Last step: turn on notifications</h3>
      <p>This is how you'll hear when you're asked to present, when dates are added or moved, and who's presenting. You'll only get notifications about this roster.</p>
      <p>Tap the button, then tap <strong>Allow</strong> when your phone asks.</p>
      <p><button class="primary big" data-act="enable-push" ${busy ? 'disabled' : ''}>Turn on notifications</button></p>
      <p class="center"><button class="link small" data-act="notify-skip">Skip for now</button></p>
    </div>`;
}

function joinView() {
  const cancel = Object.keys(devices).length ? '<button type="button" class="link" data-act="cancel-join">Cancel</button>' : '';
  let body = '';

  if (step === 'groups') {
    const mine = new Set(Object.keys(devices).map(String));
    const list = groupList
      ? (groupList.length
        ? groupList.map((g) => `<button data-act="pick-group" data-id="${g.id}" data-name="${esc(g.name)}" ${mine.has(String(g.id)) ? 'disabled' : ''}>
            ${esc(g.name)} <span class="muted small">· ${g.members} member${g.members === 1 ? '' : 's'}${mine.has(String(g.id)) ? ' · you\'re in this group' : ''}</span></button>`).join('')
        : '<p class="muted">No groups yet.</p>')
      : '<div class="spinner"></div>';
    const computerNote = OS === 'computer'
      ? '<div class="card"><p class="small muted" style="margin:0">On a computer this works in the browser, and notifications appear while the browser is open. A phone is usually easier: open this same link on your phone to set it up there.</p></div>'
      : '';
    body = `${computerNote}<div class="card"><h3 style="margin-top:0">Which supervision group are you in?</h3>
      <div class="list-names">${list}</div></div>
      <div class="card"><p style="margin-top:0">Not listed? You can add your group.</p>
      <button data-act="create-start">Start a new group</button></div>
      <p>${cancel}</p>`;
  } else if (step === 'create') {
    body = `<div class="card"><h3 style="margin-top:0">Start a new group</h3><form class="stack" data-form="create-group">
      <label class="field">Group name: your cohort and group, as members will recognise it
        <input name="name" required maxlength="80" placeholder="e.g. 1/26A"></label>
      <p class="small muted" style="margin:0">Next you'll add yourself as a member. You don't have to be the group's admin.</p>
      <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>Create group</button>
      <button type="button" class="link" data-act="back-groups">Back</button></div>
    </form></div>`;
  } else if (step === 'ask') {
    body = `<div class="card">
      <p class="muted small" style="margin-top:0">${esc(joinGroup.name)}</p>
      <h3 style="margin-top:0">Have you registered in this group before?</h3>
      <p class="muted">For example on another phone or computer.</p>
      <div class="row" style="margin-top:12px">
        <button class="big primary" data-act="onb-pick">Yes, find my name</button>
        <button class="big" data-act="onb-new">No, I'm new</button>
      </div></div><p><button class="link" data-act="back-groups">Choose a different group</button></p>`;
  } else if (step === 'new') {
    body = `<div class="card"><p class="muted small" style="margin-top:0">${esc(joinGroup.name)}</p><form class="stack" data-form="register">
      <label class="field">Your name, as the group knows you
        <input name="name" autocomplete="name" required maxlength="60"></label>
      <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>Join group</button>
      <button type="button" class="link" data-act="onb-ask">Back</button></div>
    </form></div>`;
  } else if (step === 'pick') {
    const names = memberList
      ? (memberList.length
        ? memberList.map((m) => `<button data-act="join" data-id="${m.id}" data-name="${esc(m.name)}" ${busy ? 'disabled' : ''}>${esc(m.name)}</button>`).join('')
        : '<p class="muted">Nobody has registered in this group yet. Go back and choose "No, I\'m new".</p>')
      : '<div class="spinner"></div>';
    body = `<div class="card"><p class="muted small" style="margin-top:0">${esc(joinGroup.name)}</p><h3 style="margin-top:0">Tap your name</h3>
      <div class="list-names">${names}</div>
      <p><button class="link" data-act="onb-ask">Back</button></p></div>`;
  }
  return `<header class="top"><h1>Supervision roster</h1></header>${flashHtml()}${body}
    <footer><span>Shares out who presents at supervision.</span>
    <span><a href="#admin">Group admin</a></span></footer>`;
}

function notificationCard() {
  const s = pushStatus();
  if (s === 'on') {
    return `<p class="small muted">Notifications are on for this device. <button class="link small" data-act="test-push">Send a test</button></p>`;
  }
  const texts = {
    'needs-install': 'To get notifications, add this app to your home screen (Share, then Add to Home Screen) and open it from there.',
    unsupported: 'This browser can\'t show notifications. Open the roster on your phone to get them.',
    denied: 'Notifications are blocked for this app. Turn them on in your phone\'s settings (Notifications), then reopen the app.',
  };
  if (texts[s]) return `<div class="card warn">${esc(texts[s])}</div>`;
  const err = state.device.pushError ? `<p class="small">${esc(state.device.pushError)}</p>` : '';
  return `<div class="card warn"><strong>Turn on notifications</strong>
    <p>So you know when you're asked to present and when dates change. You'll only get notifications about this roster.</p>${err}
    <button class="primary" data-act="enable-push" ${busy ? 'disabled' : ''}>Turn on notifications</button></div>`;
}

function adminOfferCard() {
  const g = state.group;
  if (g.hasAdmin || adminAsked[current]) return '';
  if (openPanel === 'admin-yes') {
    return `<div class="card notice"><strong>Become admin for ${esc(g.name)}</strong>
      <form class="stack" data-form="claim-admin" style="margin-top:10px">
        <label class="field">Choose an admin password (at least 6 characters)<input type="password" name="password" minlength="6" required autocomplete="new-password"></label>
        <label class="field">Password again<input type="password" name="password2" minlength="6" required autocomplete="new-password"></label>
        <p class="small muted" style="margin:0">You'll need it to open the admin page on another device. Keep it somewhere safe.</p>
        <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>Become admin</button>
        <button type="button" class="link" data-act="panel" data-panel="">Not now</button></div>
      </form></div>`;
  }
  return `<div class="card notice"><strong>This group doesn't have an admin yet</strong>
    <p>Anyone can add or move dates and put their hand up without being admin. The admin can also fix names, sign out a phone that picked the wrong name, correct who presented, and change settings like the number of presenting spots.</p>
    <p>Would you like to be the admin?</p>
    <div class="row"><button data-act="panel" data-panel="admin-yes">Yes, I'll be admin</button>
    <button class="link" data-act="admin-no">No thanks</button></div></div>`;
}

function groupSwitcher() {
  const gids = Object.keys(devices);
  if (gids.length < 2) return '';
  return `<label class="field switcher">Group
    <select data-change="switch-group">${gids.map((g) => `<option value="${esc(g)}" ${String(g) === String(current) ? 'selected' : ''}>${esc(groupNames[g] || 'Loading…')}</option>`).join('')}</select></label>`;
}

function sessionForm(form, s) {
  const isEdit = !!s;
  return `<form class="stack" data-form="${form}" ${isEdit ? `data-id="${s.id}"` : ''} style="margin-top:10px">
      <div class="row">
        <label class="field">Date<input type="date" name="date" required min="${todayStr()}" value="${isEdit ? esc(s.date) : ''}"></label>
        <label class="field">Time<input type="time" name="time" required value="${isEdit ? esc(s.time) : '18:00'}"></label>
      </div>
      <label class="field">Note (optional)<input name="note" maxlength="200" placeholder="e.g. online, or a different room" value="${isEdit ? esc(s.note || '') : ''}"></label>
      <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>${isEdit ? 'Save' : 'Add date'}</button>
        <button type="button" class="link" data-act="panel" data-panel="">Close</button></div>
      ${isEdit ? '<p class="small muted" style="margin:0">Everyone is notified if the date or time changes. People already presenting stay booked and can pull out if it doesn\'t suit.</p>' : '<p class="small muted" style="margin:0">Everyone is notified about the new date.</p>'}
    </form>
    ${isEdit ? `<p><button class="danger small" data-act="session-cancel" data-id="${s.id}" data-label="${esc(s.label)}">Cancel this session</button></p>` : ''}`;
}

function sessionCard(u) {
  const names = u.presenters.map((p) => (p.id === state.me.id ? '<strong>You</strong>' : esc(p.name)));
  const empty = Array.from({ length: u.open }, () => '<span class="slot-empty">open</span>');
  const slots = [...names.map((n) => `<span class="slot">${n}</span>`), ...empty].join('');
  const asked = u.asked.filter((a) => a.id !== state.me.id);
  const askedLine = asked.length ? `<div class="small muted">Asked: ${asked.map((a) => `${esc(a.name)} (reply by ${esc(a.deadline)})`).join(', ')}</div>` : '';
  const cls = u.open === 0 ? 'ok' : (u.invite ? 'warn' : '');

  let action = '';
  if (u.mine) action = `<button class="danger" data-act="drop" data-id="${u.id}" ${busy ? 'disabled' : ''}>I can no longer present</button>`;
  else if (u.invite) action = '<span class="small warn-text">You\'ve been asked: answer above</span>';
  else if (u.canHandUp) action = `<button class="primary" data-act="hand-up" data-id="${u.id}" data-label="${esc(u.label)}" ${busy ? 'disabled' : ''}>Put my hand up</button>`;

  const editing = openPanel === `edit-${u.id}`;
  return `<div class="card session">
    <div class="row spread"><div class="when">${esc(u.label)}</div>
      ${editing ? '' : `<button class="link small" data-act="panel" data-panel="edit-${u.id}">Edit</button>`}</div>
    ${u.note ? `<div class="small muted">${esc(u.note)}</div>` : ''}
    <div class="slots">${slots}</div>
    <div class="status ${cls}">${esc(u.statusText)}</div>
    ${askedLine}
    ${action ? `<div class="row" style="margin-top:8px">${action}</div>` : ''}
    ${editing ? sessionForm('session-edit', u) : ''}
    ${adminHere() ? adminSpotControls(u) : ''}
  </div>`;
}

// Admins can manage spots straight from the roster, e.g. for members who don't use the app.
function adminHere() { return !!adminTokens[current]; }

function adminSpotControls(u) {
  const free = state.tally.filter((t) => !u.presenters.some((p) => p.id === t.id));
  const panel = `spots-${u.id}`;
  if (openPanel !== panel) {
    return `<p style="margin:10px 0 0"><button class="link small" data-act="panel" data-panel="${panel}">Admin: add or remove presenters</button></p>`;
  }
  return `<div class="admin-box">
    <div class="small muted" style="margin-bottom:6px">Admin: changes here notify the group. Removing someone doesn't count as a pass.</div>
    ${u.presenters.map((p) => `<div class="row spread device"><span>${esc(p.name)}</span>
      <button class="link small danger" data-act="admin-remove" data-id="${u.id}" data-member="${p.id}" data-name="${esc(p.name)}" ${busy ? 'disabled' : ''}>Remove</button></div>`).join('')}
    ${u.open > 0 && free.length ? `<form class="inline" data-form="admin-add" data-id="${u.id}" style="margin-top:8px">
      <select name="memberId">${free.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
      <button class="primary" ${busy ? 'disabled' : ''}>Add to a spot</button></form>` : ''}
    ${u.open === 0 ? '<p class="small muted">All spots are filled. Remove someone to add someone else.</p>' : ''}
    <p class="small muted" style="margin-bottom:0">Someone not on the list? Add them by name on the Group admin page first. <button class="link small" data-act="panel" data-panel="">Close</button></p>
  </div>`;
}

function mainView() {
  const s = state;
  const g = s.group;

  const invites = s.upcoming.filter((u) => u.invite).map((u) => `<div class="card invite">
      <h3>Can you present on ${esc(u.label)}?</h3>
      ${u.note ? `<p class="muted">${esc(u.note)}</p>` : ''}
      <p>Please answer by <strong>${esc(u.invite.deadline)}</strong>. If there's no answer by then, the next person is asked and it counts as a pass. If the spots fill up first, you'll be told and it won't count.</p>
      <div class="row" style="margin-top:12px">
        <button class="big primary" data-act="accept" data-id="${u.invite.offerId}" ${busy ? 'disabled' : ''}>Yes, I'll present</button>
        <button class="big" data-act="decline" data-id="${u.invite.offerId}" ${busy ? 'disabled' : ''}>Can't this time</button>
      </div></div>`).join('');

  const sessions = s.upcoming.length ? s.upcoming.map(sessionCard).join('') : '<p class="muted">No dates yet. Add the next supervision date below.</p>';

  const addDate = openPanel === 'add'
    ? `<div class="card"><strong>Add a supervision date</strong>${sessionForm('session-add', null)}</div>`
    : `<p><button data-act="panel" data-panel="add">+ Add a date</button></p>`;

  const away = s.away.map((a) => `<div class="row spread device"><span>${esc(a.label)}</span>
      <button class="link small" data-act="away-delete" data-id="${a.id}">Remove</button></div>`).join('');

  const tally = s.tally.map((t) => `<tr${t.id === s.me.id ? ' style="font-weight:600"' : ''}><td>${esc(t.name)}</td><td class="n">${t.presented}</td>
      <td class="n">${t.booked}</td><td class="n">${t.passes}</td><td class="small">${esc(t.lastPresented || '—')}</td></tr>`).join('');

  return `<header class="top"><div><div class="muted small">Supervision roster</div><h1>${esc(g.name)}</h1></div><span class="who">${esc(s.me.name)}</span></header>
    ${groupSwitcher()}
    ${flashHtml()}
    ${notificationCard()}
    ${invites}
    ${adminOfferCard()}
    <h2>Upcoming supervision</h2>
    <p class="small muted" style="margin-top:-4px">${g.spots} presenting spots per session.</p>
    ${sessions}
    ${addDate}
    <h2>Away dates</h2>
    <div class="card">
      <p class="small muted" style="margin-top:0">You won't be asked to present at sessions on these dates.</p>
      ${away}
      <form class="inline" data-form="away" style="margin-top:8px">
        <label class="field">From<input type="date" name="from" required></label>
        <label class="field">To<input type="date" name="to" required></label>
        <button ${busy ? 'disabled' : ''}>Add</button>
      </form>
    </div>
    <h2>Tally</h2>
    <div class="card" style="padding:6px 10px;overflow-x:auto"><table>
      <thead><tr><th>Name</th><th class="n">Presented</th><th class="n">Booked</th><th class="n">Passes</th><th>Last</th></tr></thead>
      <tbody>${tally}</tbody></table></div>
    <details><summary>How presenters are chosen</summary><ul>
      <li>Anyone can put their hand up for an open spot at any time.</li>
      <li>Open spots in the next session are offered straight away, however far off it is. Later sessions are offered once they're within ${g.offerLeadDays} days, or once the session before them has happened.</li>
      <li>Spots go to the people with the fewest presentations (past plus booked). If that's tied, whoever presented longest ago is asked first.</li>
      <li>You have ${g.replyHours} hours to answer, with one reminder before the deadline.</li>
      <li>"Can't this time", or no answer, counts as a pass and the next person is asked.</li>
      <li>If the spots fill up before you answer, you're told it's full and it doesn't count against you.</li>
      <li>People who are away on the date, or whose notifications aren't working, are skipped without a pass.</li>
    </ul></details>
    <footer>
      ${installEvent ? '<span><button data-act="install">Install this app</button></span>' : ''}
      <span>Signed in as ${esc(s.me.name)} in ${esc(g.name)} on this device. <button class="link" data-act="signout">Not you? Switch person</button></span>
      <span><button class="link" data-act="join-another">Join another group</button></span>
      <span><a href="#admin">Group admin</a></span>
    </footer>`;
}

// ---------------------------------------------------------------- admin view

function adminLoginView() {
  const back = '<a href="#">Back to the roster</a>';
  const groups = groupList || [];
  if (!groups.length) {
    return `<header class="top"><h1>Group admin</h1></header>${flashHtml()}
      <div class="card"><p style="margin-top:0">There are no groups yet.</p></div><footer>${back}</footer>`;
  }
  const sel = groups.find((g) => String(g.id) === String(adminGroup)) || groups[0];
  const options = groups.map((g) => `<option value="${g.id}" ${g.id === sel.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const isMember = !!devices[sel.id];

  let main;
  if (sel.hasAdmin) {
    main = `<form class="stack" data-form="admin-login">
        <input type="hidden" name="groupId" value="${sel.id}">
        <label class="field">Admin password for ${esc(sel.name)}<input type="password" name="password" required autocomplete="current-password"></label>
        <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>Log in</button></div>
      </form>`;
  } else if (isMember) {
    main = `<p style="margin-top:0"><strong>${esc(sel.name)} doesn't have an admin yet.</strong> You're a member, so you can take it on.</p>
      <form class="stack" data-form="claim-admin" data-group="${sel.id}">
        <label class="field">Choose an admin password (at least 6 characters)<input type="password" name="password" minlength="6" required autocomplete="new-password"></label>
        <label class="field">Password again<input type="password" name="password2" minlength="6" required autocomplete="new-password"></label>
        <div class="row"><button class="primary" ${busy ? 'disabled' : ''}>Become admin</button></div>
      </form>`;
  } else {
    main = `<p style="margin-top:0"><strong>${esc(sel.name)} doesn't have an admin yet.</strong> Join the group in the app first; then you can become its admin from here.</p>`;
  }

  return `<header class="top"><h1>Group admin</h1></header>${flashHtml()}
    <div class="card">
      ${groups.length > 1 ? `<label class="field" style="margin-bottom:12px">Group<select data-change="admin-group">${options}</select></label>` : ''}
      ${main}
    </div>
    <details class="small"><summary>Master password</summary>
      <form class="inline" data-form="admin-login" style="margin-top:8px">
        <input type="hidden" name="groupId" value="${sel.id}">
        <label class="field">Master password<input type="password" name="password" required autocomplete="off"></label>
        <button>Log in to ${esc(sel.name)}</button></form>
      <p class="muted">Set when the roster server was installed. It opens any group's admin page.</p>
    </details>
    <footer>${back}</footer>`;
}

function adminView() {
  if (!adminGroup || !adminTokens[adminGroup]) return adminLoginView();
  if (!adminState) return '<div class="spinner" aria-label="Loading"></div>';
  const a = adminState;
  const g = a.group;
  const responseWord = { pending: 'waiting', accepted: 'yes', declined: 'no', expired: 'no reply', withdrawn: 'withdrawn', full: 'filled before reply', dropped: 'pulled out', unreachable: 'skipped (no notifications)', retry: 'skipped (no notifications), reconsidered later' };

  const sessions = a.sessions.map((s) => {
    const notIn = a.members.filter((m) => m.active && !s.presenters.some((p) => p.id === m.id));
    return `<div class="card session" ${s.status === 'cancelled' ? 'style="opacity:.6"' : ''}>
      <div class="when">${esc(s.label)}</div>${s.note ? `<div class="small muted">${esc(s.note)}</div>` : ''}
      <div class="status ${s.open === 0 ? 'ok' : ''}">${esc(s.statusText)}</div>
      ${s.presenters.length ? `<div class="small">Presenting: ${s.presenters.map((p) => `${esc(p.name)}${s.status === 'cancelled' ? '' : ` <button class="link small" data-act="admin" data-action="remove_presenter" data-id="${s.id}" data-member="${p.id}" data-confirm="Remove ${esc(p.name)} from this session? No pass is recorded.">remove</button>`}`).join(' · ')}</div>` : ''}
      ${s.history.length ? `<div class="small muted">Invitations: ${s.history.map((o) => `${esc(o.name)}: ${esc(responseWord[o.response] || o.response)}`).join(' · ')}</div>` : ''}
      ${s.status === 'cancelled' ? '' : `<details><summary class="small">Change</summary>
        ${notIn.length ? `<form class="inline" data-form="add-presenter" data-id="${s.id}" style="margin-top:8px">
          <select name="memberId">${notIn.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
          ${s.past ? '' : '<label class="small row"><input type="checkbox" name="notify" checked> notify group</label>'}
          <button>Add presenter</button></form>` : ''}
        ${s.past ? '<p class="small muted">Past session: changes here only correct the record.</p>' : `<div class="row" style="margin-top:8px"><button class="danger" data-act="admin" data-action="cancel_session" data-id="${s.id}" data-confirm="Cancel this session? Everyone in the group will be notified.">Cancel session</button></div>`}
      </details>`}
    </div>`;
  }).join('') || '<p class="muted">No sessions yet. Members add dates from the roster screen.</p>';

  const members = a.members.map((m) => `<div class="card" ${m.active ? '' : 'style="opacity:.6"'}>
      <div class="row spread"><strong>${esc(m.name)}</strong>
        <span class="row">${m.active ? (m.reachable ? '<span class="badge ok">notifications OK</span>' : '<span class="badge warn">no working notifications</span>') : '<span class="badge">inactive</span>'}</span></div>
      <div class="small muted">${m.presented} presented · ${m.booked} booked · ${m.passes} passes</div>
      ${m.multipleActive ? '<p class="small">More than one device used in the last 30 days. That\'s normal for a phone plus a computer, or a new phone; it could also be someone tapping the wrong name.</p>' : ''}
      ${m.devices.map((d) => `<div class="device"><div class="row spread"><span>${esc(d.label || 'Device')}</span>
          <button class="link small" data-act="admin" data-action="signout_device" data-id="${d.id}" data-confirm="Sign out this device? It will ask 'registered before?' next time it opens this group.">Sign out</button></div>
          <div class="small muted">${d.joinedVia === 'new' ? 'Registered as new' : 'Picked name from list'} · added ${esc(d.added)} · last seen ${esc(d.lastSeen)} · notifications ${d.push ? 'on' : 'off'}${d.pushError ? ` (${esc(d.pushError)})` : ''}</div></div>`).join('') || '<div class="device small muted">No devices signed in.</div>'}
      <details><summary class="small">Edit</summary>
        <form class="inline" data-form="rename" data-id="${m.id}" style="margin-top:8px"><input name="name" value="${esc(m.name)}" required><button>Rename</button></form>
        <div class="row" style="margin-top:8px">
          <button data-act="admin" data-action="test_push" data-id="${m.id}">Send test notification</button>
          <button data-act="admin" data-action="set_active" data-id="${m.id}" data-active="${m.active ? '' : '1'}">${m.active ? 'Deactivate' : 'Reactivate'}</button>
        </div>
        ${a.members.length > 1 ? `<form class="inline" data-form="merge" data-id="${m.id}" style="margin-top:8px">
          <label class="field">Merge ${esc(m.name)} into<select name="intoId">${a.members.filter((x) => x.id !== m.id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
          <button>Merge</button></form>` : ''}
      </details></div>`).join('') || '<p class="muted">Nobody has joined yet.</p>';

  const log = a.log.map((n) => `<tr><td class="small">${esc(n.when)}</td><td class="small">${esc(n.name || '')}</td>
      <td class="small">${esc(n.title)}</td><td class="small">${esc(n.status)}${n.error ? `<br>${esc(n.error)}` : ''}</td></tr>`).join('');

  const otherGroups = Object.keys(devices).length > 1 || Object.keys(adminTokens).length > 1;

  return `<header class="top"><div><div class="muted small">Group admin</div><h1>${esc(g.name)}</h1></div>
      <span class="who"><button class="link" data-act="admin-logout">Log out</button></span></header>
    ${otherGroups ? '<p class="small"><button class="link" data-act="admin-other">Manage a different group</button></p>' : ''}
    ${flashHtml()}
    <h2>Sessions</h2>
    ${sessions}
    <details class="card"><summary>Add a session</summary>
      <form class="inline" data-form="add-session" style="margin-top:8px">
        <label class="field">Date<input type="date" name="date" required min="${todayStr()}"></label>
        <label class="field">Time<input type="time" name="time" value="18:00" required></label>
        <label class="field">Note (optional)<input name="note"></label>
        <button>Add</button></form>
      <p class="small muted">Members can also add and move dates themselves from the roster screen.</p></details>
    <h2>Members</h2>${members}
    <div class="card"><form class="inline" data-form="add-member">
      <label class="field">Add a member by name<input name="name" required></label><button>Add</button></form>
      <p class="small muted">Optional. People can also join the group themselves in the app.</p></div>
    <h2>Group settings</h2>
    <div class="card"><form class="stack" data-form="group-settings">
      <label class="field">Group name<input name="name" value="${esc(g.name)}" required maxlength="80"></label>
      <div class="row">
        <label class="field">Presenters per session<input type="number" name="spots" min="1" max="10" value="${g.spots}" style="width:110px"></label>
        <label class="field">Also invite for later sessions within (days)<input type="number" name="offerLeadDays" min="3" max="60" value="${g.offerLeadDays}" style="width:110px"></label>
        <label class="field">Hours to answer<input type="number" name="replyHours" min="12" max="168" value="${g.replyHours}" style="width:110px"></label>
      </div>
      <div><button ${busy ? 'disabled' : ''}>Save settings</button></div></form></div>
    <div class="card"><form class="inline" data-form="change-password">
      <label class="field">New admin password<input type="password" name="password" minlength="6" required autocomplete="new-password"></label>
      <button>Change password</button></form></div>
    <div class="card"><button data-act="admin" data-action="run_tick">Run the scheduler now</button>
      <p class="small muted">It runs by itself every hour.</p></div>
    <h2>Notification log</h2>
    <details class="card"><summary>Show the last 30 notifications</summary>
      <div style="overflow-x:auto;margin-top:8px"><table>
      <thead><tr><th>When</th><th>To</th><th>Notification</th><th>Result</th></tr></thead>
      <tbody>${log || '<tr><td colspan="4" class="muted">Nothing sent yet.</td></tr>'}</tbody></table></div></details>
    <h2>Step down or remove</h2>
    <div class="card"><p class="small muted" style="margin-top:0">Step down: the group will have no admin, and the next member to open the app is offered the role.</p>
      <button data-act="admin" data-action="step_down" data-confirm="Step down as admin of ${esc(g.name)}?">Step down as admin</button></div>
    <div class="card"><p class="small muted" style="margin-top:0">Remove: takes the group off the list and signs its members out of it. Its records are kept on the server.</p>
      <button class="danger" data-act="admin" data-action="archive_group" data-confirm="Remove ${esc(g.name)} from the list? Members will be signed out of it.">Remove this group</button></div>
    <footer><a href="#">Back to the roster</a></footer>`;
}

// ---------------------------------------------------------------- events

function startJoining() {
  joining = true; step = 'groups'; groupList = null; joinGroup = null; memberList = null; say(null); render();
  api('groups', undefined, { token: null }).then((r) => { groupList = r.groups; render(); })
    .catch((e) => { say(e.message, 'warn'); render(); });
}

function signedIn(r) {
  devices[r.groupId] = r.token;
  saveDevices();
  setCurrent(r.groupId);
  joining = false; step = 'groups'; state = null; openPanel = null;
  notifyStep = true;
  say(null);
}

el.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const d = b.dataset;
  const id = Number(d.id);
  switch (d.act) {
    case 'skip-install': store.set(K_SKIP_INSTALL, '1'); render(); break;
    case 'cancel-join': joining = false; say(null); refresh(); break;
    case 'back-groups': startJoining(); break;
    case 'create-start': step = 'create'; say(null); render(); break;
    case 'pick-group': joinGroup = { id, name: d.name }; step = 'ask'; say(null); render(); break;
    case 'onb-ask': step = 'ask'; say(null); render(); break;
    case 'onb-new': step = 'new'; say(null); render(); break;
    case 'onb-pick':
      step = 'pick'; memberList = null; say(null); render();
      api(`groups/${joinGroup.id}/members`, undefined, { token: null }).then((r) => { memberList = r.members; render(); })
        .catch((e) => { say(e.message, 'warn'); step = 'ask'; render(); });
      break;
    case 'join':
      if (!confirm(`Sign in as ${d.name} on this device?`)) return;
      act(async () => { signedIn(await api('join', { memberId: id }, { token: null })); return null; })
        .then(() => { if (state) syncPush(); });
      break;
    case 'join-another': startJoining(); break;
    case 'panel': openPanel = d.panel || null; say(null); render(); break;
    case 'admin-no':
      adminAsked[current] = 1; store.setObj(K_ADMIN_ASKED, adminAsked);
      say('No problem. If you change your mind, it\'s under Group admin at the bottom.'); render();
      break;
    case 'enable-push': act(async () => { const m = await enablePush(); notifyStep = false; return m; }); break;
    case 'notify-skip':
      notifyStep = false;
      say('You can turn notifications on any time from the top of this screen.'); render();
      break;
    case 'test-push': act(async () => (await api('test-push', {})).message); break;
    case 'accept': act(async () => (await api('respond', { offerId: id, action: 'accept' })).message); break;
    case 'decline':
      if (!confirm('Pass on this session? The next person will be asked, and it counts as a pass.')) return;
      act(async () => (await api('respond', { offerId: id, action: 'decline' })).message);
      break;
    case 'hand-up':
      if (!confirm(`Take a presenting spot on ${d.label}?`)) return;
      act(async () => (await api('hand-up', { sessionId: id })).message);
      break;
    case 'drop':
      if (!confirm('Pull out of this session? The spot will be offered to someone else, and it counts as a pass.')) return;
      act(async () => (await api('drop', { sessionId: id })).message);
      break;
    case 'session-cancel':
      if (!confirm(`Cancel the session on ${d.label}? Everyone will be notified.`)) return;
      act(async () => (await api('session-cancel', { sessionId: id })).message);
      break;
    case 'away-delete': act(async () => (await api('away-delete', { id })).message); break;
    case 'signout':
      if (!confirm(`Sign out of ${state.group.name} on this device? You can sign back in by picking your name.`)) return;
      act(async () => {
        try { await api('signout', {}); } catch (e) { /* already signed out */ }
        forgetGroup(current);
        if (current) { joining = false; } else { startJoining(); }
        return 'Signed out on this device.';
      });
      break;
    case 'install':
      installEvent.prompt();
      installEvent.userChoice.then((c) => {
        if (c && c.outcome === 'accepted') say('Added. Now close the browser and open Supervision from your home screen.');
      }).finally(() => { installEvent = null; render(); });
      break;
    case 'admin-remove':
      if (!confirm(`Remove ${d.name} from this session? It won't count as a pass.`)) return;
      adminGroup = current;
      act(async () => (await api('admin/action', { action: 'remove_presenter', id, memberId: Number(d.member) }, { admin: true })).message, { closePanel: false });
      break;
    case 'admin-logout':
      saveAdminToken(adminGroup, null); adminState = null; say(null); refresh();
      break;
    case 'admin-other':
      adminGroup = null; adminState = null; say(null); refresh();
      break;
    case 'admin':
      if (d.confirm && !confirm(d.confirm)) return;
      act(async () => {
        const r = await api('admin/action', { action: d.action, id, memberId: Number(d.member), active: !!d.active }, { admin: true });
        if (r.loggedOut) {
          saveAdminToken(adminGroup, null);
          if (d.action === 'archive_group' && devices[adminGroup]) forgetGroup(adminGroup);
          adminState = null;
        }
        return r.message;
      });
      break;
  }
});

el.addEventListener('change', (ev) => {
  const s = ev.target.closest('[data-change]');
  if (!s) return;
  if (s.dataset.change === 'switch-group') {
    setCurrent(s.value); state = null; openPanel = null; say(null); render(); refresh();
  } else if (s.dataset.change === 'admin-group') {
    adminGroup = s.value; say(null); render();
  }
});

el.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const v = Object.fromEntries(new FormData(f).entries());
  const id = Number(f.dataset.id);
  const adminAct = (body) => act(async () => (await api('admin/action', body, { admin: true })).message);
  switch (f.dataset.form) {
    case 'create-group':
      act(async () => {
        const r = await api('groups', { name: v.name }, { token: null });
        joinGroup = { id: r.groupId, name: r.name };
        step = 'new';
        return `${r.name} is set up. Now add yourself as a member.`;
      });
      break;
    case 'register':
      act(async () => { signedIn(await api('register', { groupId: joinGroup.id, name: v.name }, { token: null })); return null; });
      break;
    case 'claim-admin': {
      if (v.password !== v.password2) { say('The two passwords don\'t match.', 'warn'); render(); return; }
      const gid = f.dataset.group || current;
      act(async () => {
        const r = await api('claim-admin', { password: v.password }, { token: devices[gid] });
        saveAdminToken(String(r.groupId), r.token);
        adminGroup = String(r.groupId);
        return `${r.message} Open Group admin at the bottom of the roster whenever you need it.`;
      });
      break;
    }
    case 'session-add': act(async () => (await api('session-add', { date: v.date, time: v.time, note: v.note })).message); break;
    case 'session-edit': act(async () => (await api('session-edit', { sessionId: id, date: v.date, time: v.time, note: v.note })).message); break;
    case 'away': act(async () => (await api('away', { from: v.from, to: v.to })).message); break;
    case 'admin-login':
      act(async () => {
        const r = await api('admin/login', { groupId: Number(v.groupId), password: v.password }, { token: null });
        adminGroup = String(r.groupId); saveAdminToken(adminGroup, r.token);
        return null;
      });
      break;
    case 'add-session': adminAct({ action: 'add_session', date: v.date, time: v.time, note: v.note }); break;
    case 'admin-add':
      adminGroup = current;
      act(async () => (await api('admin/action', { action: 'add_presenter', id, memberId: Number(v.memberId), notify: true }, { admin: true })).message, { closePanel: false });
      break;
    case 'add-presenter': adminAct({ action: 'add_presenter', id, memberId: Number(v.memberId), notify: !!v.notify }); break;
    case 'add-member': adminAct({ action: 'add_member', name: v.name }); break;
    case 'rename': adminAct({ action: 'rename_member', id, name: v.name }); break;
    case 'merge':
      if (!confirm('Merge these two? Everything from the first name moves to the second, and the first name is removed.')) return;
      adminAct({ action: 'merge_members', fromId: id, intoId: Number(v.intoId) });
      break;
    case 'group-settings':
      adminAct({ action: 'group_settings', name: v.name, spots: Number(v.spots), offerLeadDays: Number(v.offerLeadDays), replyHours: Number(v.replyHours) });
      groupNames = {};
      break;
    case 'change-password':
      act(async () => {
        const r = await api('admin/action', { action: 'change_password', password: v.password }, { admin: true });
        saveAdminToken(adminGroup, r.token);
        return r.message;
      });
      break;
  }
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; render(); });
window.addEventListener('hashchange', () => {
  say(null); openPanel = null;
  if (isAdminView()) { adminGroup = current || adminGroup; adminState = null; }
  render(); refresh();
});
// Refresh when the app comes back to the front, unless a form is open.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !busy && !openPanel) refresh(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'open-group' && devices[e.data.group] && !isAdminView()) {
      setCurrent(e.data.group); state = null; joining = false;
    }
    if (!openPanel) refresh();
  });
}

// Opened from a notification: ?g=<groupId> selects that group.
const startGroup = new URLSearchParams(location.search).get('g');
if (startGroup && devices[startGroup]) { setCurrent(startGroup); joining = false; }
if (startGroup) history.replaceState(null, '', location.pathname + location.hash);

render();
if (joining) startJoining(); else { refresh(); loadGroupNames(); }
