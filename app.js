(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var RADII = [0, 1, 3, 10, 25]; // km; 0 = no limit
  var IS_ANDROID = /Android/i.test(navigator.userAgent);

  var STRINGS = {
    he: {
      dir: 'rtl',
      title: 'החלפת גז סודהסטרים',
      locate: '📍 מצא קרוב אליי',
      search: 'סינון לפי עיר, רשת או כתובת',
      more: 'הצג עוד',
      source: 'נתונים: אתר סודהסטרים ישראל',
      place: 'Google Maps',
      navigate: 'ניווט',
      call: 'התקשר',
      loading: 'טוען נקודות…',
      loadError: 'לא ניתן לטעון את רשימת החנויות.',
      locating: 'מאתר מיקום…',
      noGeo: 'לא ניתן לקבל מיקום. אפשר ללחוץ על המפה כדי לבחור נקודה.',
      hint: '{n} נקודות. שתפו מיקום או לחצו על המפה כדי למיין לפי מרחק.',
      fromYou: 'ממוינות לפי מרחק ממך · {n} נקודות',
      fromPoint: 'ממוינות לפי מרחק מהנקודה שנבחרה · {n} נקודות',
      none: 'לא נמצאו נקודות',
      noneRadius: 'אין נקודות בטווח {n} ק״מ. נסו טווח גדול יותר.',
      range: 'טווח:',
      all: 'הכל',
      m: 'מ׳',
      km: 'ק״מ',
      you: 'המיקום שלך',
      picked: 'נקודה שנבחרה'
    },
    en: {
      dir: 'ltr',
      title: 'SodaStream Gas Exchange',
      locate: '📍 Find near me',
      search: 'Filter by city, chain or address',
      more: 'Show more',
      source: 'Data: SodaStream Israel website',
      place: 'Google Maps',
      navigate: 'Navigate',
      call: 'Call',
      loading: 'Loading locations…',
      loadError: 'Could not load the store list.',
      locating: 'Getting your location…',
      noGeo: "Couldn't get your location. Tap the map to pick a point instead.",
      hint: '{n} locations. Share your location or tap the map to sort by distance.',
      fromYou: 'Sorted by distance from you · {n} locations',
      fromPoint: 'Sorted by distance from the picked point · {n} locations',
      none: 'No locations found',
      noneRadius: 'No locations within {n} km. Try a larger range.',
      range: 'Range:',
      all: 'All',
      m: 'm',
      km: 'km',
      you: 'Your location',
      picked: 'Picked point'
    }
  };

  var state = {
    lang: load('lang') || 'he',
    stores: [],
    origin: null,          // {lat, lng, kind: 'gps' | 'picked'}
    query: '',
    radius: Number(load('radius')) || 0,
    shown: PAGE_SIZE,
    selectedId: null,
    loadError: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list');
  var statusEl = $('status');
  var moreEl = $('more');
  var searchEl = $('search');
  var radiusEl = $('radius');

  function load(key) {
    try { return localStorage.getItem('sodamap.' + key); } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem('sodamap.' + key, value); } catch (e) { /* ignore */ }
  }
  function t(key, n) {
    return STRINGS[state.lang][key].replace('{n}', n);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Map ----------
  var map = L.map('map', { zoomControl: true }).setView([31.75, 34.95], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  var renderer = L.canvas({ padding: 0.5 });
  var markers = {};
  var originMarker = null;
  var radiusCircle = null;

  map.on('click', function (e) {
    setOrigin(e.latlng.lat, e.latlng.lng, 'picked', false);
  });

  // ---------- Links ----------
  function placeUrl(s) {
    // Search by branch name + address so Google opens the store's place page
    // (with its hours and reviews) rather than a bare pin.
    var name = s.name.replace(/\(\s*\d+\s*\)/g, '').trim();
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(name + ', ' + s.address);
  }
  function navUrl(s) {
    if (IS_ANDROID) {
      // geo: opens Android's app chooser (Google Maps, Waze, Moovit…).
      return 'geo:' + s.lat + ',' + s.lng + '?q=' + s.lat + ',' + s.lng +
        '(' + encodeURIComponent(s.name.replace(/[()]/g, '')) + ')';
    }
    return 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lng;
  }
  function actionsHtml(s) {
    var html = '<div class="actions">' +
      '<a href="' + esc(placeUrl(s)) + '" target="_blank" rel="noopener">' + esc(t('place')) + '</a>' +
      '<a href="' + esc(navUrl(s)) + '"' + (IS_ANDROID ? '' : ' target="_blank" rel="noopener"') + '>' +
      esc(t('navigate')) + '</a>';
    if (/\d/.test(s.phone)) {
      html += '<a href="tel:' + esc(s.phone.replace(/[^\d+*#]/g, '')) + '">' + esc(t('call')) + ' ' +
        '<bdi>' + esc(s.phone) + '</bdi></a>';
    }
    return html + '</div>';
  }

  // ---------- Distance ----------
  function haversine(a, b) {
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) {
    if (m < 1000) return Math.round(m / 10) * 10 + ' ' + t('m');
    return (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' ' + t('km');
  }

  // ---------- Rendering ----------
  function filtered() {
    var q = state.query.trim().toLowerCase();
    var out = state.stores.filter(function (s) {
      return !q || s.search.indexOf(q) !== -1;
    });
    if (state.origin) {
      out.forEach(function (s) { s.dist = haversine(state.origin, s); });
      if (state.radius) {
        out = out.filter(function (s) { return s.dist <= state.radius * 1000; });
      }
      out.sort(function (a, b) { return a.dist - b.dist; });
    } else {
      out.sort(function (a, b) { return a.address.localeCompare(b.address, 'he'); });
    }
    return out;
  }

  function render() {
    var items = filtered();
    var visible = items.slice(0, state.shown);

    if (state.loadError) {
      statusEl.textContent = t('loadError');
    } else if (!state.stores.length) {
      statusEl.textContent = t('loading');
    } else if (!items.length) {
      statusEl.textContent = state.origin && state.radius ? t('noneRadius', state.radius) : t('none');
    } else if (state.origin) {
      statusEl.textContent = t(state.origin.kind === 'gps' ? 'fromYou' : 'fromPoint', items.length);
    } else {
      statusEl.textContent = t('hint', items.length);
    }

    listEl.innerHTML = visible.map(function (s) {
      return '<li class="store' + (s.id === state.selectedId ? ' selected' : '') + '" data-id="' + s.id + '">' +
        '<div class="store-head"><span class="store-name" dir="auto">' + esc(s.name) + '</span>' +
        (state.origin ? '<span class="store-dist">' + fmtDist(s.dist) + '</span>' : '') + '</div>' +
        '<div class="store-meta"><bdi>' + esc(s.address) + '</bdi>' + (s.chain ? ' · <bdi>' + esc(s.chain) + '</bdi>' : '') + '</div>' +
        actionsHtml(s) + '</li>';
    }).join('');
    moreEl.hidden = items.length <= state.shown;

    renderRadius();

    // Dim markers that are filtered out.
    var match = {};
    items.forEach(function (s) { match[s.id] = true; });
    state.stores.forEach(function (s) {
      var on = !!match[s.id];
      markers[s.id].setStyle({ opacity: on ? 1 : 0.15, fillOpacity: on ? 0.85 : 0.1 });
    });
  }

  function renderRadius() {
    var html = '<span>' + esc(t('range')) + '</span>' + RADII.map(function (km) {
      return '<button type="button" class="chip-r' + (km === state.radius ? ' on' : '') + '" data-km="' + km + '"' +
        (state.origin ? '' : ' disabled') + ' aria-pressed="' + (km === state.radius) + '">' +
        (km ? km + ' ' + esc(t('km')) : esc(t('all'))) + '</button>';
    }).join('');
    if (radiusEl.innerHTML !== html) radiusEl.innerHTML = html;

    if (radiusCircle) { radiusCircle.remove(); radiusCircle = null; }
    if (state.origin && state.radius) {
      radiusCircle = L.circle([state.origin.lat, state.origin.lng], {
        radius: state.radius * 1000, color: '#d93025', weight: 1.5, fillOpacity: 0.04, interactive: false
      }).addTo(map);
    }
  }

  function fitToOrigin() {
    if (!state.origin) return;
    if (radiusCircle) {
      map.fitBounds(radiusCircle.getBounds(), { padding: [10, 10] });
      return;
    }
    var near = filtered().slice(0, 5).map(function (s) { return [s.lat, s.lng]; });
    near.push([state.origin.lat, state.origin.lng]);
    map.fitBounds(near, { padding: [30, 30], maxZoom: 15 });
  }

  function popupHtml(s) {
    return '<strong dir="auto">' + esc(s.name) + '</strong><br><bdi>' + esc(s.address) + '</bdi>' +
      (state.origin ? '<br>' + fmtDist(haversine(state.origin, s)) : '') + actionsHtml(s);
  }

  function select(id, pan) {
    state.selectedId = id;
    var s = state.stores.find(function (x) { return x.id === id; });
    if (!s) return;
    var m = markers[id];
    m.setPopupContent(popupHtml(s));
    if (pan) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 15));
    m.openPopup();
    render();
    var li = listEl.querySelector('[data-id="' + id + '"]');
    if (li && !pan) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function setOrigin(lat, lng, kind, fit) {
    state.origin = { lat: lat, lng: lng, kind: kind };
    state.shown = PAGE_SIZE;
    save('origin', JSON.stringify(state.origin));
    var label = t(kind === 'gps' ? 'you' : 'picked');
    if (originMarker) originMarker.remove();
    originMarker = L.circleMarker([lat, lng], {
      radius: 9, color: '#ffffff', weight: 3, fillColor: '#d93025', fillOpacity: 1
    }).bindTooltip(label).addTo(map);
    render();
    if (fit) fitToOrigin();
    $('list').parentElement.scrollTop = 0;
  }

  function locate() {
    if (!navigator.geolocation) {
      statusEl.textContent = t('noGeo');
      return;
    }
    statusEl.textContent = t('locating');
    navigator.geolocation.getCurrentPosition(function (pos) {
      setOrigin(pos.coords.latitude, pos.coords.longitude, 'gps', true);
    }, function () {
      statusEl.textContent = t('noGeo');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  // ---------- Language ----------
  function applyLang() {
    var S = STRINGS[state.lang];
    document.documentElement.lang = state.lang;
    document.documentElement.dir = S.dir;
    document.title = S.title;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = S[el.getAttribute('data-i18n')];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = S[el.getAttribute('data-i18n-placeholder')];
    });
    $('lang').textContent = state.lang === 'he' ? 'EN' : 'עב';
    if (originMarker) originMarker.setTooltipContent(t(state.origin.kind === 'gps' ? 'you' : 'picked'));
    map.closePopup();
    render();
  }

  // ---------- Events ----------
  $('locate').addEventListener('click', locate);
  $('lang').addEventListener('click', function () {
    state.lang = state.lang === 'he' ? 'en' : 'he';
    save('lang', state.lang);
    applyLang();
  });
  searchEl.addEventListener('input', function () {
    state.query = searchEl.value;
    state.shown = PAGE_SIZE;
    render();
  });
  radiusEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    state.radius = Number(b.getAttribute('data-km'));
    state.shown = PAGE_SIZE;
    save('radius', String(state.radius));
    render();
    fitToOrigin();
  });
  moreEl.addEventListener('click', function () {
    state.shown += PAGE_SIZE;
    render();
  });
  listEl.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var li = e.target.closest('.store');
    if (li) select(Number(li.getAttribute('data-id')), true);
  });

  // ---------- Data ----------
  function init(stores) {
    state.stores = stores.map(function (s) {
      s.search = (s.name + ' ' + s.chain + ' ' + s.address).toLowerCase();
      return s;
    });
    stores.forEach(function (s) {
      markers[s.id] = L.circleMarker([s.lat, s.lng], {
        renderer: renderer, radius: 6, color: '#ffffff', weight: 1.5,
        fillColor: '#0b5cab', fillOpacity: 0.85
      }).bindPopup('', { minWidth: 240 }).on('click', function () { select(s.id, false); }).addTo(map);
    });
    var saved = null;
    try { saved = JSON.parse(load('origin')); } catch (e) { /* ignore */ }
    if (saved && typeof saved.lat === 'number') {
      setOrigin(saved.lat, saved.lng, saved.kind, true);
    } else {
      render();
    }
  }

  applyLang();
  fetch('data/stores.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () { state.loadError = true; render(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  }
})();
