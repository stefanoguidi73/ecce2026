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
  let view = "day"; // "day" | "mine"

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

  // assign a rotating accent colour to each session, in a stable day/time order.
  // Also build a flat index of every paper -> where it lives (session/day/time context),
  // used both for the accent map and for the "Mine" view.
  const sessionAccent = new Map();
  const paperIndex = new Map(); // id -> { paper, day, time, sessionTitle, track }
  (function buildIndex() {
    let i = 0;
    DAY_ORDER.forEach(day => {
      (AGENDA[day] || []).forEach(block => {
        block.tracks.forEach(tr => {
          if (tr.kind === 'session') {
            sessionAccent.set(tr.session, ACCENTS[i % ACCENTS.length]);
            i++;
            tr.session.papers.forEach(p => {
              paperIndex.set(p.id, { paper: p, day, time: block.start, sessionTitle: tr.session.title, track: tr.track });
            });
          }
        });
      });
    });
    RESERVE.forEach(p => {
      paperIndex.set(p.id, { paper: p, day: null, time: null, sessionTitle: 'Riserva', track: null });
    });
  })();

  const daytabsEl = document.getElementById('daytabs');
  const minetabEl = document.getElementById('minetab');
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
    daytabsEl.innerHTML = '';
    DAY_ORDER.forEach(day => {
      const btn = document.createElement('button');
      btn.className = 'daytab' + (view === 'day' && day === currentDay && !query ? ' active' : '');
      btn.innerHTML = '<span class="d">' + day + '</span>' + DAY_LABEL[day];
      btn.onclick = () => { query = ''; searchEl.value = ''; view = 'day'; currentDay = day; render(); };
      daytabsEl.appendChild(btn);
    });
    minetabEl.innerHTML = '';
    const mine = document.createElement('button');
    mine.className = 'daytab mine' + (view === 'mine' && !query ? ' active' : '');
    mine.innerHTML = '<span class="d">★</span>Mine';
    mine.onclick = () => { query = ''; searchEl.value = ''; view = 'mine'; render(); };
    minetabEl.appendChild(mine);
  }

  function paperHTML(p, q, ctx) {
    const isBookmarked = bookmarks.has(p.id);
    const note = notes[p.id] || '';
    const ctxLine = ctx ? `<div class="mineitem-ctx">${esc(ctx)}</div>` : '';
    return `
      <div class="paper" data-pid="${p.id}">
        ${ctxLine}
        <div class="ptop">
          <div class="ptopleft">
            <span class="pid">#${p.id}</span>
            <span class="ptype">${esc(p.type)}</span>
          </div>
          <button class="bookmark ${isBookmarked ? 'on' : ''}" data-action="toggle-bookmark" data-pid="${p.id}" aria-label="Salva in Il mio programma">${isBookmarked ? '★' : '☆'}</button>
        </div>
        <div class="ptitle">${highlight(p.title, q)}</div>
        <div class="pauthors">${highlight(p.authors, q)}</div>
        <div class="pmore" data-action="toggle-detail">dettagli ↓</div>
        <div class="pdetail">
          <div>${esc(p.abstract || 'Abstract non disponibile.')}</div>
          ${p.keywords ? `<div class="kw">${esc(p.keywords)}</div>` : ''}
          <div class="notewrap">
            <label for="note-${p.id}">Le tue note</label>
            <textarea id="note-${p.id}" data-action="note" data-pid="${p.id}" placeholder="Scrivi qui le tue note su questo talk…">${esc(note)}</textarea>
            <div class="savedhint" data-role="savedhint">salvato</div>
          </div>
        </div>
      </div>`;
  }

  function sessionCardHTML(tr, q, trackLabel) {
    const s = tr.session;
    const accent = sessionAccent.get(s) || 'var(--g-pink)';
    const openCount = s.papers.filter(p => paperMatches(p, q)).length;
    const forceOpen = q && openCount > 0;
    return `
      <div class="card session" data-role="session" style="--accent:${accent}">
        <span class="chev">${forceOpen ? '▾' : '▸'}</span>
        ${trackLabel ? `<div class="tracklabel">Track ${trackLabel}</div>` : ''}
        <h3>${esc(s.title)}</h3>
        <div class="count">${s.papers.length} paper</div>
        <div class="paperlist ${forceOpen ? 'open' : ''}">
          ${s.papers.filter(p => paperMatches(p, q)).map(p => paperHTML(p, q)).join('')}
        </div>
      </div>`;
  }

  function workshopCardHTML(tr) {
    return `
      <div class="card workshop">
        <div class="wtitle">${esc(tr.title)}</div>
        <div class="wmeta">Palazzo San Niccolò, Via Roma 56, Siena</div>
        <div class="wmeta">For registered participants only</div>
        <span class="wbadge">Workshop</span>
      </div>`;
  }

  function eventCardHTML(tr) {
    const cls = tr.kind === 'keynote' ? 'card event keynote' : 'card event';
    return `<div class="${cls}"><span class="label">${esc(tr.title)}</span></div>`;
  }

  function blockHTML(block, q) {
    const visibleTracks = block.tracks.map(tr => {
      if (tr.kind === 'session') {
        const anyMatch = !q || tr.session.papers.some(p => paperMatches(p, q));
        return anyMatch ? { tr, html: sessionCardHTML(tr, q, tr.track) } : null;
      }
      if (tr.kind === 'workshop') {
        return q ? null : { tr, html: workshopCardHTML(tr) };
      }
      return q ? null : { tr, html: eventCardHTML(tr) };
    }).filter(Boolean);

    if (visibleTracks.length === 0) return '';
    const twoCls = visibleTracks.length > 1 ? ' two' : '';
    return `
      <div class="block">
        <div class="time">${block.start}${block.end ? '<span>– ' + block.end + '</span>' : ''}</div>
        <div class="tracks${twoCls}">${visibleTracks.map(v => v.html).join('')}</div>
      </div>`;
  }

  function renderDay(day, q) {
    const blocksHtml = (AGENDA[day] || []).map(b => blockHTML(b, q)).join('');
    return blocksHtml || '';
  }

  function renderReserve(q) {
    const items = RESERVE.filter(p => paperMatches(p, q));
    if (items.length === 0) return '';
    return `
      <div class="reserve">
        <h2>Paper in riserva</h2>
        <p class="note">Surplus rispetto alla capienza delle sessioni — da collocare se si liberano slot.</p>
        ${items.map(p => paperHTML(p, q)).join('')}
      </div>`;
  }

  function renderMine() {
    const ids = [...bookmarks];
    if (ids.length === 0) {
      return `<div class="empty"><span class="big">☆</span>Non hai ancora salvato nessun paper.<br>Tocca la stellina su un paper per aggiungerlo qui.</div>`;
    }
    const dayRank = { "15": 0, "16": 1, "17": 2, "18": 3 };
    const items = ids
      .map(id => paperIndex.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const da = a.day ? dayRank[a.day] : 9, db = b.day ? dayRank[b.day] : 9;
        if (da !== db) return da - db;
        return (a.time || '').localeCompare(b.time || '');
      });
    return items.map(item => {
      const ctxParts = [];
      if (item.day) ctxParts.push(DAY_FULL[item.day] + (item.time ? ' · ' + item.time : ''));
      ctxParts.push(item.sessionTitle + (item.track ? ' (Track ' + item.track + ')' : ''));
      return paperHTML(item.paper, '', ctxParts.join(' — '));
    }).join('');
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
      if (!html) html = '<div class="empty">Nessun risultato per questa ricerca.</div>';
      const n = collectAllSessionsForSearch().length;
      searchMetaEl.textContent = n + (n === 1 ? ' risultato' : ' risultati');
      mainEl.innerHTML = html;
    } else if (view === 'mine') {
      mainEl.innerHTML = renderMine();
      searchMetaEl.textContent = '';
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
      });
    });
    mainEl.querySelectorAll('[data-action="toggle-detail"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const detail = el.nextElementSibling;
        const open = detail.classList.toggle('open');
        el.textContent = open ? 'dettagli ↑' : 'dettagli ↓';
      });
    });
    mainEl.querySelectorAll('[data-action="toggle-bookmark"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-pid'));
        if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
        saveBookmarks();
        if (view === 'mine') {
          render();
        } else {
          btn.classList.toggle('on');
          btn.textContent = bookmarks.has(id) ? '★' : '☆';
        }
      });
    });
    mainEl.querySelectorAll('[data-action="note"]').forEach(ta => {
      let t = null;
      ta.addEventListener('input', () => {
        const id = Number(ta.getAttribute('data-pid'));
        notes[id] = ta.value;
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
