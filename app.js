(function () {
  const DATA = JSON.parse(document.getElementById('program-data').textContent);
  const AGENDA = DATA.agenda;
  const RESERVE = DATA.reserve;
  const DAY_ORDER = ["15", "16", "17", "18"];
  const DAY_LABEL = { "15": "Pre", "16": "Gio 16", "17": "Ven 17", "18": "Sab 18" };

  let currentDay = "16";
  let query = "";

  const daytabsEl = document.getElementById('daytabs');
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
    // used to know if a day has any match, and to render a flattened search view
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
      btn.className = 'daytab' + (day === currentDay && !query ? ' active' : '');
      btn.innerHTML = '<span class="d">' + day + '</span>' + DAY_LABEL[day];
      btn.onclick = () => { query = ''; searchEl.value = ''; currentDay = day; render(); };
      daytabsEl.appendChild(btn);
    });
  }

  function paperHTML(p, q) {
    return `
      <div class="paper" data-pid="${p.id}">
        <div class="ptop">
          <span class="pid">#${p.id}</span>
          <span class="ptype">${esc(p.type)}</span>
        </div>
        <div class="ptitle">${highlight(p.title, q)}</div>
        <div class="pauthors">${highlight(p.authors, q)}</div>
        <div class="pmore" data-action="toggle-detail">dettagli ↓</div>
        <div class="pdetail">
          <div>${esc(p.abstract || 'Abstract non disponibile.')}</div>
          ${p.keywords ? `<div class="kw">${esc(p.keywords)}</div>` : ''}
        </div>
      </div>`;
  }

  function sessionCardHTML(tr, q, trackLabel) {
    const s = tr.session;
    const openCount = s.papers.filter(p => paperMatches(p, q)).length;
    const forceOpen = q && openCount > 0;
    return `
      <div class="card session" data-role="session">
        <span class="chev">${forceOpen ? '▾' : '▸'}</span>
        ${trackLabel ? `<div class="tracklabel">Track ${trackLabel}</div>` : ''}
        <h3>${esc(s.title)}</h3>
        <div class="count">${s.papers.length} paper</div>
        <div class="paperlist ${forceOpen ? 'open' : ''}">
          ${s.papers.filter(p => paperMatches(p, q)).map(p => paperHTML(p, q)).join('')}
        </div>
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
      return q ? null : { tr, html: eventCardHTML(tr) };
    }).filter(Boolean);

    if (visibleTracks.length === 0) return '';
    const twoCls = visibleTracks.length > 1 ? ' two' : '';
    const timeLabel = block.end ? `${block.start}<span>${block.end}</span>` : block.start;
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

  function render() {
    renderTabs();
    if (query) {
      searchMetaEl.textContent = '';
      let html = '';
      DAY_ORDER.forEach(day => {
        const dayHtml = renderDay(day, query);
        if (dayHtml) html += `<h2 class="daytitle">${DAY_LABEL[day]}</h2>` + dayHtml;
      });
      const reserveHtml = renderReserve(query);
      if (reserveHtml) html += reserveHtml;
      if (!html) html = '<div class="empty">Nessun risultato per questa ricerca.</div>';
      const n = collectAllSessionsForSearch().length;
      searchMetaEl.textContent = n + (n === 1 ? ' risultato' : ' risultati');
      mainEl.innerHTML = html;
    } else {
      mainEl.innerHTML = renderDay(currentDay, '') + (currentDay === '18' ? renderReserve('') : '');
      searchMetaEl.textContent = '';
    }
    attachHandlers();
  }

  function attachHandlers() {
    mainEl.querySelectorAll('[data-role="session"]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.paper')) return; // don't toggle when interacting inside a paper
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
  }

  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = searchEl.value.trim(); render(); }, 120);
  });

  render();
})();
