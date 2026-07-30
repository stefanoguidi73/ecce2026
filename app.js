(function () {
  const DATA = JSON.parse(document.getElementById('program-data').textContent);
  const AGENDA = DATA.agenda;
  const RESERVE = DATA.reserve;
  const DAY_ORDER = ["15", "16", "17", "18"];
  const DAY_LABEL = { "15": "Tue", "16": "Wed", "17": "Thu", "18": "Fri" };
  const DAY_FULL = { "15": "Tue 15 September", "16": "Wed 16 September", "17": "Thu 17 September", "18": "Fri 18 September" };
  const ACCENTS = ['var(--g-orange)', 'var(--g-pink)', 'var(--g-purple)', 'var(--g-blue)', 'var(--g-green)'];

  const LS_BOOKMARKS = 'ecce2026_bookmarks';
  const LS_NOTES = 'ecce2026_notes';

  let currentDay = "16";
  let query = "";
  let view = "day"; // "overview" | "day" | "mine" | "notes" | "where"

  function loadBookmarks() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_BOOKMARKS) || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveBookmarks() {
    try { localStorage.setItem(LS_BOOKMARKS, JSON.stringify([...bookmarks])); } catch (e) {}
  }
  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(LS_NOTES) || '{}'); }
    catch (e) { return {}; }
  }
  function saveNotes() {
    try { localStorage.setItem(LS_NOTES, JSON.stringify(notes)); } catch (e) {}
  }

  let bookmarks = loadBookmarks();
  let notes = loadNotes();

  // assign a rotating accent colour to each session, and a stable string key,
  // in a stable day/time order. The key lets us remember which session cards
  // the user has manually expanded across re-renders (e.g. after a bookmark toggle).
  const sessionAccent = new Map();
  const sessionKey = new Map();
  const openSessions = new Set();
  (function buildSessionMeta() {
    let i = 0;
    DAY_ORDER.forEach(day => {
      (AGENDA[day] || []).forEach(block => {
        block.tracks.forEach(tr => {
          if (tr.kind === 'session') {
            sessionAccent.set(tr.session, ACCENTS[i % ACCENTS.length]);
            sessionKey.set(tr.session, day + '|' + block.start + '|' + (tr.track || ''));
            i++;
          }
        });
      });
    });
  })();

  const tabstripEl = document.getElementById('tabstrip');
  const mainEl = document.getElementById('main');
  const searchEl = document.getElementById('search');
  const searchMetaEl = document.getElementById('searchmeta');

  // ---------- helpers ----------
  function esc(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const t = esc(text);
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return t;
    return t.slice(0, idx) + '<mark>' + t.slice(idx, idx + q.length) + '</mark>' + t.slice(idx + q.length);
  }

  function paperMatches(p, q) {
    if (!q) return true;
    const hay = (p.title + ' ' + p.authors + ' ' + (p.keywords || '')).toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  // ---------- calendar (.ics) export ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function icsDateTime(day, time) {
    if (!day || !time) return null;
    const [h, m] = time.split(':');
    return `202609${day}T${pad2(h)}${pad2(m)}00`;
  }
  function icsEscape(s) {
    return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }
  function downloadICS({ title, location, description, day, start, end }) {
    const dtStart = icsDateTime(day, start);
    if (!dtStart) return;
    let dtEnd = end ? icsDateTime(day, end) : null;
    if (!dtEnd) {
      let [h, m] = start.split(':').map(Number);
      h = (h + 1) % 24;
      dtEnd = icsDateTime(day, pad2(h) + ':' + pad2(m));
    }
    const uid = 'ecce2026-' + Math.random().toString(36).slice(2) + '@ecce2026';
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ECCE2026//Programme//IT',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + dtstamp,
      'DTSTART:' + dtStart,
      'DTEND:' + dtEnd,
      'SUMMARY:' + icsEscape(title),
      'LOCATION:' + icsEscape(location || ''),
      'DESCRIPTION:' + icsEscape(description || ''),
      'END:VEVENT', 'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || 'evento').replace(/[^\w\-]+/g, '_').slice(0, 60) + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function calButtonHTML(cal) {
    if (!cal || !cal.day || !cal.start) return '';
    return `<button class="calbtn" data-action="add-calendar"
      data-cal-title="${esc(cal.title)}" data-cal-loc="${esc(cal.location || '')}"
      data-cal-desc="${esc(cal.description || '')}" data-cal-day="${esc(cal.day)}"
      data-cal-start="${esc(cal.start)}" data-cal-end="${esc(cal.end || '')}"
      aria-label="Add to calendar" title="Add to calendar">🗓</button>`;
  }

  function collectAllSessionsForSearch() {
    const results = [];
    DAY_ORDER.forEach(day => {
      (AGENDA[day] || []).forEach(block => {
        block.tracks.forEach(tr => {
          if (tr.kind === 'session') {
            tr.session.papers.forEach(p => {
              if (paperMatches(p, query)) results.push({ day, block, tr, p });
            });
          }
        });
      });
    });
    RESERVE.forEach(p => {
      if (paperMatches(p, query)) results.push({ day: null, reserve: true, p });
    });
    return results;
  }

  // ---------- render ----------
  function renderTabs() {
    tabstripEl.innerHTML = '';
    const addTab = (id, dTop, label, targetView) => {
      const btn = document.createElement('button');
      btn.className = 'daytab' + (view === targetView && !query ? ' active' : '');
      btn.innerHTML = '<span class="d">' + dTop + '</span>' + label;
      btn.onclick = () => { query = ''; searchEl.value = ''; view = targetView; render(); };
      tabstripEl.appendChild(btn);
    };
    DAY_ORDER.forEach(day => {
      const btn = document.createElement('button');
      btn.className = 'daytab' + (view === 'day' && day === currentDay && !query ? ' active' : '');
      btn.innerHTML = '<span class="d">' + day + '</span>' + DAY_LABEL[day];
      btn.onclick = () => { query = ''; searchEl.value = ''; view = 'day'; currentDay = day; render(); };
      tabstripEl.appendChild(btn);
    });
    addTab('mine', '★', 'Mine', 'mine');
    addTab('notes', '✎', 'Notes', 'notes');
    addTab('where', '📍', 'Where', 'where');
  }

  function paperHTML(p, q, timeCtx, sessionTitle) {
    const isBookmarked = bookmarks.has(p.id);
    const note = notes[p.id] || '';
    const calBtn = timeCtx ? calButtonHTML({
      title: p.title,
      location: 'ECCE 2026 — Siena, Italy',
      description: (sessionTitle ? sessionTitle + ' — ' : '') + p.authors,
      day: timeCtx.day, start: timeCtx.start, end: timeCtx.end
    }) : '';
    return `
      <div class="paper" data-pid="${p.id}">
        <div class="ptop">
          <div class="ptopleft">
            <span class="pid">#${p.id}</span>
            <span class="ptype">${esc(p.type)}</span>
          </div>
          <div class="ptopright">
            ${calBtn}
            <button class="bookmark ${isBookmarked ? 'on' : ''}" data-action="toggle-bookmark" data-pid="${p.id}" aria-label="Save to My programme">${isBookmarked ? '★' : '☆'}</button>
          </div>
        </div>
        <div class="ptitle">${highlight(p.title, q)}</div>
        <div class="pauthors">${highlight(p.authors, q)}</div>
        <div class="prow">
          <div class="pmore" data-action="toggle-detail">details ↓</div>
          <span class="noteicon ${note ? 'on' : ''}" data-role="noteicon" title="${note ? 'You have saved notes' : 'No notes'}">✎</span>
        </div>
        <div class="pdetail">
          <div>${esc(p.abstract || 'Abstract not available.')}</div>
          ${p.keywords ? `<div class="kw">${esc(p.keywords)}</div>` : ''}
          <div class="notewrap">
            <label for="note-${p.id}">Your notes</label>
            <textarea id="note-${p.id}" data-action="note" data-pid="${p.id}" placeholder="Write your notes on this talk…">${esc(note)}</textarea>
            <div class="savedhint" data-role="savedhint">saved</div>
          </div>
        </div>
      </div>`;
  }

  function sessionCardHTML(tr, q, trackLabel, opts, timeCtx) {
    opts = opts || {};
    const filterFn = opts.filterFn || (p => paperMatches(p, q));
    const s = tr.session;
    const accent = sessionAccent.get(s) || 'var(--g-pink)';
    const matched = s.papers.filter(filterFn);
    const key = sessionKey.get(s) || '';
    const forceOpen = !!opts.forceOpen || openSessions.has(key) || (!!q && matched.length > 0);
    const countLabel = matched.length === s.papers.length
      ? `${s.papers.length} papers`
      : `${matched.length} of ${s.papers.length} papers`;
    const savedCount = s.papers.filter(p => bookmarks.has(p.id)).length;
    const savedBadge = savedCount > 0 ? `<span class="savedcount">${'★'.repeat(savedCount)}</span>` : '';
    return `
      <div class="card session" data-role="session" data-skey="${esc(key)}" style="--accent:${accent}">
        <span class="chev">${forceOpen ? '▾' : '▸'}</span>
        ${trackLabel ? `<div class="tracklabel">Track ${trackLabel}</div>` : ''}
        <h3>${esc(s.title)}</h3>
        <div class="count">${countLabel}${savedBadge}</div>
        <div class="paperlist ${forceOpen ? 'open' : ''}">
          ${matched.map(p => paperHTML(p, q, timeCtx, s.title)).join('')}
        </div>
      </div>`;
  }

  function workshopCardHTML(tr, timeCtx) {
    const calBtn = timeCtx ? calButtonHTML({
      title: tr.title, location: 'Santa Chiara Lab, Siena',
      description: 'ECCE 2026 — registered participants only',
      day: timeCtx.day, start: timeCtx.start, end: timeCtx.end
    }) : '';
    return `
      <div class="card workshop">
        <div class="wtop"><div class="wtitle">${esc(tr.title)}</div>${calBtn}</div>
        <div class="wmeta">Santa Chiara Lab, Siena</div>
        <div class="wmeta">For registered participants only</div>
        <span class="wbadge">Workshop</span>
      </div>`;
  }

  function eventCardHTML(tr, timeCtx) {
    const cls = tr.kind === 'keynote' ? 'card event keynote' : 'card event';
    const calBtn = (tr.kind === 'keynote' && timeCtx) ? calButtonHTML({
      title: tr.title, location: 'ECCE 2026 — Siena, Italy', description: '',
      day: timeCtx.day, start: timeCtx.start, end: timeCtx.end
    }) : '';
    return `<div class="${cls}"><span class="label">${esc(tr.title)}</span>${calBtn}</div>`;
  }

  function blockHTML(day, block, q, opts) {
    opts = opts || {};
    const filterFn = opts.filterFn || (p => paperMatches(p, q));
    const customFilter = !!opts.filterFn;
    const timeCtx = { day, start: block.start, end: block.end };
    const visibleTracks = block.tracks.map(tr => {
      if (tr.kind === 'session') {
        const anyMatch = tr.session.papers.some(filterFn);
        return anyMatch ? { tr, html: sessionCardHTML(tr, q, tr.track, opts, timeCtx) } : null;
      }
      if (tr.kind === 'workshop') {
        return (q || customFilter) ? null : { tr, html: workshopCardHTML(tr, timeCtx) };
      }
      return (q || customFilter) ? null : { tr, html: eventCardHTML(tr, timeCtx) };
    }).filter(Boolean);

    if (visibleTracks.length === 0) return '';
    const twoCls = visibleTracks.length > 1 ? ' two' : '';
    return `
      <div class="block">
        <div class="time">${block.start}${block.end ? '<span>– ' + block.end + '</span>' : ''}</div>
        <div class="tracks${twoCls}">${visibleTracks.map(v => v.html).join('')}</div>
      </div>`;
  }

  function renderDay(day, q, opts) {
    const blocksHtml = (AGENDA[day] || []).map(b => blockHTML(day, b, q, opts)).join('');
    return blocksHtml || '';
  }

  function renderReserve(q) {
    const items = RESERVE.filter(p => paperMatches(p, q));
    if (items.length === 0) return '';
    return `
      <div class="reserve">
        <h2>Reserve papers</h2>
        <p class="note">Surplus beyond session capacity — to be placed if a slot frees up.</p>
        ${items.map(p => paperHTML(p, q)).join('')}
      </div>`;
  }

  function downloadAllNotes(items) {
    const lines = ['ECCE 2026 — My notes', ''];
    items.forEach(({ p }) => {
      lines.push('#' + p.id + ' — ' + p.title);
      lines.push('Authors: ' + p.authors);
      lines.push('');
      lines.push('Abstract:');
      lines.push(p.abstract || '(not available)');
      lines.push('');
      lines.push('My notes:');
      lines.push(notes[p.id]);
      lines.push('');
      lines.push('----------------------------------------');
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecce2026_notes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function renderNotesTab() {
    const filterFn = p => (notes[p.id] || '').trim().length > 0;
    const items = [];
    DAY_ORDER.forEach(day => {
      (AGENDA[day] || []).forEach(block => {
        block.tracks.forEach(tr => {
          if (tr.kind === 'session') {
            tr.session.papers.forEach(p => { if (filterFn(p)) items.push({ p }); });
          }
        });
      });
    });
    RESERVE.forEach(p => { if (filterFn(p)) items.push({ p }); });

    if (items.length === 0) {
      return `<div class="empty"><span class="big">✎</span>You haven't written any notes yet.<br>Open a paper's details to get started.</div>`;
    }

    const downloadBtn = `<div class="notes-download"><button data-action="download-all-notes">⬇ Download all notes (.txt)</button></div>`;
    let html = downloadBtn;
    DAY_ORDER.forEach(day => {
      const dayHtml = renderDay(day, '', { filterFn, forceOpen: true });
      if (dayHtml) html += `<h2 class="daytitle">${DAY_FULL[day]}</h2>` + dayHtml;
    });
    return html;
  }

  // ---------- Where: venues + map ----------
  // Coordinates are approximate (city-block level) fallbacks in case live
  // geocoding is unavailable; the Contrada dell'Onda address in particular
  // should be double-checked against the definitive event address.
  const VENUES = [
    {
      key: 'sanniccolo',
      name: 'Palazzo San Niccolò',
      org: 'Università di Siena',
      address: 'Via Roma 56, 53100 Siena',
      fallback: [43.3123, 11.3322],
      schedule: [
        { day: 'Wed 16 Sep', text: 'Registration, keynote (Agnieszka Wykowska), paper sessions, coffee breaks & lunch' },
        { day: 'Thu 17 Sep', text: 'Parallel paper sessions all day, General Assembly' },
        { day: 'Fri 18 Sep', text: 'Parallel paper sessions, Awards & closing' },
      ]
    },
    {
      key: 'santachiara',
      name: 'Santa Chiara Lab',
      org: 'Università di Siena',
      address: 'Via Valdimontone 1, 53100 Siena',
      fallback: [43.3184, 11.3298],
      schedule: [
        { day: 'Tue 15 Sep', text: 'Workshop on Cognition and LLMs (14:30–17:30), Welcome reception (17:30–18:00)' },
        { day: 'Wed 16 Sep', text: 'Keynote (Patrizia Marti, 18:00–19:00), Welcome reception (19:00–19:30)' },
      ]
    },
    {
      key: 'onda',
      name: "Contrada dell'Onda",
      org: 'Contrada Capitana dell\u2019Onda',
      address: 'Via Giovanni Duprè, Siena',
      note: 'Provisional — venue for the keynote and social dinner is not yet 100% confirmed.',
      fallback: [43.3178, 11.3288],
      schedule: [
        { day: 'Thu 17 Sep', text: 'Keynote (Harry Witchel, 18:00–19:00), visit to the contrada (19:00–19:30), social dinner (from 20:00)' },
      ]
    },
  ];

  let mapInstance = null;
  let routeShown = false;
  let routeLayer = null;

  function venueCardHTML(v) {
    return `
      <div class="venue-card">
        <h3>${esc(v.name)}</h3>
        <div class="vaddr">${esc(v.address)}${v.org ? ' — ' + esc(v.org) : ''}</div>
        ${v.note ? `<div class="vnote">${esc(v.note)}</div>` : ''}
        ${v.schedule.map(s => `<div class="vwhen"><b>${esc(s.day)}:</b> ${esc(s.text)}</div>`).join('')}
      </div>`;
  }

  function renderWhere() {
    return `
      <div class="venues">${VENUES.map(venueCardHTML).join('')}</div>
      <div class="mapwrap">
        <div class="maptoolbar"><button id="route-toggle" data-action="toggle-route">Show walking route</button></div>
        <div id="leaflet-map"></div>
        <div class="map-note">Map data © OpenStreetMap contributors · Tiles by CARTO</div>
      </div>`;
  }

  async function geocode(address) {
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address));
      const data = await res.json();
      if (data && data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch (e) { /* fall through to fallback */ }
    return null;
  }

  async function initMap() {
    const el = document.getElementById('leaflet-map');
    if (!el || typeof L === 'undefined') return;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    routeShown = false;
    routeLayer = null;

    const map = L.map(el).setView([43.3178, 11.3305], 15);
    mapInstance = map;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    const points = [];
    for (const v of VENUES) {
      let coords = await geocode(v.address + ', Italy');
      if (!coords) coords = v.fallback;
      points.push(coords);
      L.circleMarker(coords, {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#CB648A',
        fillOpacity: 0.95
      }).addTo(map).bindPopup(`<b>${esc(v.name)}</b><br>${esc(v.address)}`);
    }
    if (points.length) {
      map.fitBounds(points, { padding: [30, 30] });
    }

    const routeBtn = document.getElementById('route-toggle');
    if (routeBtn) {
      routeBtn.addEventListener('click', async () => {
        if (routeShown) {
          if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
          routeShown = false;
          routeBtn.classList.remove('on');
          routeBtn.textContent = 'Show walking route';
          return;
        }
        routeBtn.textContent = 'Loading…';
        const coordsStr = points.map(p => p[1] + ',' + p[0]).join(';');
        let line = null;
        try {
          const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`);
          const data = await res.json();
          if (data && data.routes && data.routes[0]) {
            const latlngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            line = L.polyline(latlngs, { color: '#C8532E', weight: 4, opacity: 0.8 });
          }
        } catch (e) { /* fall back to straight line below */ }
        if (!line) {
          line = L.polyline(points, { color: '#C8532E', weight: 3, opacity: 0.7, dashArray: '6 6' });
        }
        routeLayer = line.addTo(map);
        routeShown = true;
        routeBtn.classList.add('on');
        routeBtn.textContent = 'Hide walking route';
      });
    }
  }

  function renderMine() {
    if (bookmarks.size === 0) {
      return `<div class="empty"><span class="big">☆</span>You haven't saved any papers yet.<br>Tap the star on a paper to add it here.</div>`;
    }
    const filterFn = p => bookmarks.has(p.id);
    let html = '';
    DAY_ORDER.forEach(day => {
      const dayHtml = renderDay(day, '', { filterFn, forceOpen: true });
      if (dayHtml) html += `<h2 class="daytitle">${DAY_FULL[day]}</h2>` + dayHtml;
    });
    const reserveItems = RESERVE.filter(filterFn);
    if (reserveItems.length > 0) {
      html += `
        <h2 class="daytitle">Reserve</h2>
        <div class="reserve" style="margin-top:0; padding-top:0;">
          ${reserveItems.map(p => paperHTML(p, '')).join('')}
        </div>`;
    }
    return html || `<div class="empty">No saved papers in this selection.</div>`;
  }

  function render() {
    renderTabs();
    if (query) {
      searchMetaEl.textContent = '';
      let html = '';
      DAY_ORDER.forEach(day => {
        const dayHtml = renderDay(day, query);
        if (dayHtml) html += `<h2 class="daytitle">${DAY_FULL[day]}</h2>` + dayHtml;
      });
      const reserveHtml = renderReserve(query);
      if (reserveHtml) html += reserveHtml;
      if (!html) html = '<div class="empty">No results for this search.</div>';
      const n = collectAllSessionsForSearch().length;
      searchMetaEl.textContent = n + (n === 1 ? ' result' : ' results');
      mainEl.innerHTML = html;
    } else if (view === 'mine') {
      mainEl.innerHTML = renderMine();
      searchMetaEl.textContent = '';
    } else if (view === 'notes') {
      mainEl.innerHTML = renderNotesTab();
      searchMetaEl.textContent = '';
    } else if (view === 'where') {
      mainEl.innerHTML = renderWhere();
      searchMetaEl.textContent = '';
      initMap();
    } else {
      mainEl.innerHTML = renderDay(currentDay, '') + (currentDay === '18' ? renderReserve('') : '');
      searchMetaEl.textContent = '';
    }
    attachHandlers();
  }

  function attachHandlers() {
    mainEl.querySelectorAll('[data-role="session"]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.paper')) return;
        const list = card.querySelector('.paperlist');
        const chev = card.querySelector('.chev');
        const isOpen = list.classList.toggle('open');
        chev.textContent = isOpen ? '▾' : '▸';
        const key = card.getAttribute('data-skey');
        if (key) { if (isOpen) openSessions.add(key); else openSessions.delete(key); }
      });
    });
    mainEl.querySelectorAll('[data-action="toggle-detail"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const detail = el.closest('.paper').querySelector('.pdetail');
        const open = detail.classList.toggle('open');
        el.textContent = open ? 'details ↑' : 'details ↓';
      });
    });
    mainEl.querySelectorAll('[data-role="noteicon"]').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const paper = icon.closest('.paper');
        const detail = paper.querySelector('.pdetail');
        const more = paper.querySelector('[data-action="toggle-detail"]');
        detail.classList.add('open');
        more.textContent = 'details ↑';
        const ta = paper.querySelector('textarea[data-action="note"]');
        if (ta) { ta.focus(); if (ta.scrollIntoView) ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      });
    });
    mainEl.querySelectorAll('[data-action="download-all-notes"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filterFn = p => (notes[p.id] || '').trim().length > 0;
        const items = [];
        DAY_ORDER.forEach(day => {
          (AGENDA[day] || []).forEach(block => {
            block.tracks.forEach(tr => {
              if (tr.kind === 'session') {
                tr.session.papers.forEach(p => { if (filterFn(p)) items.push({ p }); });
              }
            });
          });
        });
        RESERVE.forEach(p => { if (filterFn(p)) items.push({ p }); });
        downloadAllNotes(items);
      });
    });
    mainEl.querySelectorAll('[data-action="add-calendar"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadICS({
          title: btn.getAttribute('data-cal-title'),
          location: btn.getAttribute('data-cal-loc'),
          description: btn.getAttribute('data-cal-desc'),
          day: btn.getAttribute('data-cal-day'),
          start: btn.getAttribute('data-cal-start'),
          end: btn.getAttribute('data-cal-end'),
        });
      });
    });
    mainEl.querySelectorAll('[data-action="toggle-bookmark"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-pid'));
        if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
        saveBookmarks();
        render();
      });
    });
    mainEl.querySelectorAll('[data-action="note"]').forEach(ta => {
      let t = null;
      ta.addEventListener('input', () => {
        const id = Number(ta.getAttribute('data-pid'));
        notes[id] = ta.value;
        const icon = ta.closest('.paper').querySelector('[data-role="noteicon"]');
        if (icon) icon.classList.toggle('on', ta.value.trim().length > 0);
        clearTimeout(t);
        t = setTimeout(() => {
          saveNotes();
          const hint = ta.closest('.notewrap').querySelector('[data-role="savedhint"]');
          if (hint) {
            hint.classList.add('show');
            clearTimeout(hint._t);
            hint._t = setTimeout(() => hint.classList.remove('show'), 1200);
          }
        }, 400);
      });
    });
  }

  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = searchEl.value.trim(); render(); }, 120);
  });

  render();
})();
