/** Подписи в форме задачи и прогресс на Ганта (0–100) по статусу с бэкенда. */
const STATUS_COLUMNS = [
    { status: 'TODO', title: 'Бэклог', progress: 10 },
    { status: 'DEPLOY', title: 'Развёртывание', progress: 20 },
    { status: 'PREPARE', title: 'Подготовка', progress: 40 },
    { status: 'IN_PROGRESS', title: 'В работе', progress: 55 },
    { status: 'REVIEW', title: 'Завершение', progress: 85 },
    { status: 'DONE', title: 'Готово', progress: 100 }
];

/** Столбцы канбана: один столбец = несколько статусов. Порядок статусов в «В работе» — трактовка склейки и сортировки. */
const BOARD_LANES = [
    { key: 'backlog', title: 'Бэклог', statuses: ['TODO'] },
    { key: 'active', title: 'В работе', statuses: ['DEPLOY', 'PREPARE', 'IN_PROGRESS', 'REVIEW'] },
    { key: 'done', title: 'Готово', statuses: ['DONE'] }
];

function laneKeyOfStatus(status) {
    const lane = BOARD_LANES.find((l) => l.statuses.includes(status));
    return lane ? lane.key : 'backlog';
}

/** Целевой статус задачи после переноса в другой столбец (перестановка в том же столбце — статус не меняется). */
function resolveStatusAfterLaneMove(fromStatus, targetLaneKey) {
    const fromLane = laneKeyOfStatus(fromStatus);
    if (fromLane === targetLaneKey) {
        return fromStatus;
    }
    if (targetLaneKey === 'backlog') {
        return 'TODO';
    }
    if (targetLaneKey === 'done') {
        return 'DONE';
    }
    /* в активный столбец */
    return fromLane === 'done' ? 'REVIEW' : 'DEPLOY';
}

/** Индекс в целевом «подстолбце» статуса для API move (boardOrder считается внутри одного статуса). */
function boardOrderAmongStatus(mergedTaskIds, movedId, targetStatus) {
    const stacked = mergedTaskIds.filter((tid) => {
        const t = state.tasks.find((x) => x.id === tid);
        const eff = tid === movedId ? targetStatus : t?.status;
        return eff === targetStatus;
    });
    const idx = stacked.indexOf(movedId);
    return idx < 0 ? 0 : idx;
}

function sortTasksInLane(laneKey, list) {
    if (laneKey === 'active') {
        const lane = BOARD_LANES.find((l) => l.key === 'active');
        const ord = lane.statuses;
        const rank = (s) => {
            const i = ord.indexOf(s);
            return i >= 0 ? i : 99;
        };
        return [...list].sort((a, b) => rank(a.status) - rank(b.status) || a.boardOrder - b.boardOrder);
    }
    return [...list].sort((a, b) => a.boardOrder - b.boardOrder);
}

const DEFAULT_TASK_STATUS = STATUS_COLUMNS[0].status;

function ganttProgressForStatus(status) {
    const col = STATUS_COLUMNS.find((c) => c.status === status);
    if (!col || typeof col.progress !== 'number') {
        return 0;
    }
    return Math.min(100, Math.max(0, col.progress));
}

function isGanttTaskCompleted(t) {
    return t.status === 'DONE' || ganttProgressForStatus(t.status) >= 100;
}

function tasksForGanttChart() {
    if (state.ganttShowCompleted) {
        return state.tasks;
    }
    return state.tasks.filter((t) => !isGanttTaskCompleted(t));
}

function syncGanttToolbar() {
    const btn = $('#btnGanttToggleCompleted');
    const onGantt = state.currentView === 'gantt';
    btn.classList.toggle('hidden', !onGantt);
    if (!onGantt) {
        return;
    }
    btn.setAttribute('aria-label', state.ganttShowCompleted ? 'Скрыть завершённые' : 'Показать завершённые');
    btn.setAttribute('aria-pressed', state.ganttShowCompleted ? 'false' : 'true');
    btn.title = state.ganttShowCompleted
        ? 'Не показывать задачи со статусом «Готово» или прогрессом 100%'
        : 'Показывать завершённые задачи на диаграмме';
    btn.querySelector('.icon-eye-open')?.classList.toggle('hidden', !state.ganttShowCompleted);
    btn.querySelector('.icon-eye-off')?.classList.toggle('hidden', state.ganttShowCompleted);
}

function fillTaskStatusSelect() {
    const sel = $('#fldStatus');
    const keep = sel.value;
    sel.innerHTML = '';
    for (const col of STATUS_COLUMNS) {
        const o = document.createElement('option');
        o.value = col.status;
        o.textContent = col.title;
        sel.appendChild(o);
    }
    sel.value = [...sel.options].some((opt) => opt.value === keep) ? keep : DEFAULT_TASK_STATUS;
}

const state = {
    tasks: [],
    labels: [],
    assignees: [],
    filters: { assigneeId: '', labelIds: [] },
    assigneeDialogTarget: 'filter',
    gantt: null,
    ganttShowCompleted: true,
    currentView: 'kanban'
};

const $ = (sel) => document.querySelector(sel);

function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        el.hidden = true;
    }, 3200);
}

async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...opts
    });
    if (!res.ok) {
        let err = res.statusText;
        try {
            const j = await res.json();
            err = j.error || err;
        } catch (e) {
            /* ignore */
        }
        throw new Error(err);
    }
    if (res.status === 204) {
        return null;
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('application/json')) {
        return res.json();
    }
    return null;
}

function buildTaskQuery() {
    const p = new URLSearchParams();
    const aid = state.filters.assigneeId;
    if (aid) {
        p.set('assigneeId', aid);
    }
    for (const id of state.filters.labelIds) {
        if (Number.isFinite(id)) {
            p.append('labelIds', String(id));
        }
    }
    const qs = p.toString();
    return qs ? `?${qs}` : '';
}

async function loadAssignees() {
    const keepFilter = $('#filterAssignee') ? $('#filterAssignee').value : '';
    const keepTask = $('#fldAssignee') ? $('#fldAssignee').value : '';
    state.assignees = await api('/api/assignees');
    fillAssigneeSelect($('#filterAssignee'), keepFilter, 'Любой');
    fillAssigneeSelect($('#fldAssignee'), keepTask, 'Не назначен');
}

function fillAssigneeSelect(sel, valueAfter, firstLabel) {
    const desired = String(valueAfter ?? '');
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = firstLabel;
    sel.appendChild(o0);
    for (const a of state.assignees) {
        const o = document.createElement('option');
        o.value = String(a.id);
        o.textContent = a.name;
        sel.appendChild(o);
    }
    sel.value = [...sel.options].some((opt) => opt.value === desired) ? desired : '';
}

function buildLabelCheckboxList(scrollEl, inputClass) {
    scrollEl.innerHTML = '';
    for (const lb of state.labels) {
        const row = document.createElement('label');
        row.className = 'label-multi-row';
        row.dataset.name = (lb.name || '').toLowerCase();
        row.innerHTML = `<input type="checkbox" value="${lb.id}" class="${inputClass}"/> <span style="color:${escapeAttr(lb.color || '#64748b')}">●</span> <span class="label-multi-name">${escapeHtml(lb.name)}</span>`;
        scrollEl.appendChild(row);
    }
}

async function loadLabels() {
    state.labels = await api('/api/labels');
    const filterSel = new Set(state.filters.labelIds.map(String));
    buildLabelCheckboxList($('#labelMultiScroll'), 'label-multi-chk');
    buildLabelCheckboxList($('#filterLabelMultiScroll'), 'filter-label-chk');
    $('#filterLabelMultiScroll').querySelectorAll('.filter-label-chk').forEach((c) => {
        c.checked = filterSel.has(c.value);
    });
    updateFilterLabelTriggerText();
}

function buildLabelMultiList() {
    buildLabelCheckboxList($('#labelMultiScroll'), 'label-multi-chk');
}

function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toggleLabelDropdown(show) {
    const dd = $('#labelMultiDropdown');
    const trig = $('#labelMultiTrigger');
    const open = typeof show === 'boolean' ? show : dd.hidden;
    dd.hidden = !open;
    trig.setAttribute('aria-expanded', String(open));
}

function updateLabelTriggerText() {
    const trig = $('#labelMultiTrigger');
    const checked = [...$('#labelMultiScroll').querySelectorAll('.label-multi-chk:checked')];
    if (checked.length === 0) {
        trig.textContent = 'Выберите метки…';
        return;
    }
    const names = checked.map((ch) => {
        const lb = state.labels.find((l) => String(l.id) === ch.value);
        return lb ? lb.name : ch.value;
    });
    trig.textContent = names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${names.length - 3})` : '');
}

function updateFilterLabelTriggerText() {
    const trig = $('#filterLabelMultiTrigger');
    const checked = [...$('#filterLabelMultiScroll').querySelectorAll('.filter-label-chk:checked')];
    if (checked.length === 0) {
        trig.textContent = 'Любые';
        return;
    }
    const names = checked.map((ch) => {
        const lb = state.labels.find((l) => String(l.id) === ch.value);
        return lb ? lb.name : ch.value;
    });
    trig.textContent = names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${names.length - 3})` : '');
}

function bindLabelMultiOnce() {
    const wrap = $('#labelMultiWrap');
    const trig = $('#labelMultiTrigger');
    const dd = $('#labelMultiDropdown');
    const search = $('#labelMultiSearch');
    trig.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLabelDropdown(dd.hidden);
    });
    dd.addEventListener('click', (e) => e.stopPropagation());
    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        wrap.querySelectorAll('.label-multi-row').forEach((row) => {
            const n = row.dataset.name || '';
            row.style.display = !q || n.includes(q) ? '' : 'none';
        });
    });
    $('#labelMultiScroll').addEventListener('change', updateLabelTriggerText);
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            toggleLabelDropdown(false);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleLabelDropdown(false);
        }
    });
}

function bindFilterLabelMultiOnce() {
    const wrap = $('#filterLabelMultiWrap');
    const trig = $('#filterLabelMultiTrigger');
    const dd = $('#filterLabelMultiDropdown');
    const search = $('#filterLabelMultiSearch');
    trig.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = dd.hidden;
        dd.hidden = !open;
        trig.setAttribute('aria-expanded', String(open));
    });
    dd.addEventListener('click', (e) => e.stopPropagation());
    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        wrap.querySelectorAll('.label-multi-row').forEach((row) => {
            const n = row.dataset.name || '';
            row.style.display = !q || n.includes(q) ? '' : 'none';
        });
    });
    $('#filterLabelMultiScroll').addEventListener('change', updateFilterLabelTriggerText);
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            dd.hidden = true;
            trig.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dd.hidden = true;
            trig.setAttribute('aria-expanded', 'false');
        }
    });
}

function taskLinkTrimmed(t) {
    const s = t?.link;
    return typeof s === 'string' ? s.trim() : '';
}

/** Для открытия во вкладке: без схемы подставляет https:// */
function hrefForOpenInTab(linkTrimmed) {
    if (!linkTrimmed) {
        return null;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(linkTrimmed)) {
        return linkTrimmed;
    }
    return `https://${linkTrimmed}`;
}

async function loadTasks() {
    state.tasks = await api(`/api/tasks${buildTaskQuery()}`);
    if (state.currentView === 'kanban') {
        renderBoard();
    } else {
        renderGantt();
    }
}

function renderBoard() {
    const board = $('#board');
    board.innerHTML = '';
    const knownStatuses = new Set(STATUS_COLUMNS.map((s) => s.status));
    for (const lane of BOARD_LANES) {
        const list = [];
        for (const t of state.tasks) {
            if (lane.statuses.includes(t.status)) {
                list.push(t);
            }
        }
        const sorted = sortTasksInLane(lane.key, list);
        const orphansInLane =
            lane.key === 'backlog'
                ? state.tasks.filter((t) => !knownStatuses.has(t.status))
                : [];
        const merged = [...sorted, ...sortTasksInLane('backlog', orphansInLane)];
        const wrap = document.createElement('div');
        wrap.className = 'column';
        wrap.dataset.laneKey = lane.key;
        wrap.innerHTML = `<div class="column-header"><span>${lane.title}</span><span class="pill">${merged.length}</span></div>`;
        const body = document.createElement('div');
        body.className = 'column-body';
        body.dataset.laneKey = lane.key;
        for (const t of merged) {
            body.appendChild(renderCard(t));
        }
        body.addEventListener('dragover', onColDragOver);
        body.addEventListener('drop', onColDrop);
        wrap.appendChild(body);
        board.appendChild(wrap);
    }
}

function renderCard(t) {
    const el = document.createElement('div');
    el.className = 'card';
    el.draggable = true;
    el.dataset.taskId = String(t.id);
    el.addEventListener('dragstart', onCardDragStart);
    const tags = (t.labels || [])
        .map((l) => `<span class="tag" style="border-color:${l.color || '#94a3b8'}">${escapeHtml(l.name)}</span>`)
        .join(' ');
    const assigneeHtml = t.assignee
        ? `<span class="pill pill-assignee">${escapeHtml(t.assignee.name)}</span>`
        : '';
    const msPill = t.kind === 'MILESTONE' ? `<span class="pill pill-milestone" title="Веха на Ганте">Веха</span>` : '';
    const lt = taskLinkTrimmed(t);
    const linkPart = lt
        ? `<button type="button" class="card-link-mark card-link-hit" draggable="false" aria-label="Открыть ссылку" title="${escapeHtml(
              lt
          )}">✅</button>`
        : `<span class="card-link-mark" aria-label="Ссылка не задана" title="Ссылка не задана">❌</span>`;

    el.innerHTML = `
    <div class="card-top">
      <p class="card-title">${escapeHtml(t.title)}</p>${linkPart}
    </div>
    <div class="meta">${msPill} ${assigneeHtml} ${tags}</div>
    <div class="card-actions">
      <button type="button" class="btn mini link" data-action="edit">Изменить</button>
    </div>`;

    const linkHit = el.querySelector('.card-link-hit');
    if (linkHit) {
        const href = hrefForOpenInTab(lt);
        linkHit.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!href) {
                return;
            }
            window.open(href, '_blank', 'noopener,noreferrer');
        });
        linkHit.addEventListener('mousedown', (e) => e.stopPropagation());
        linkHit.addEventListener('dragstart', (e) => e.preventDefault());
    }
    el.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openTaskDialog(t);
    });
    return el;
}

let dragTaskId = null;

function onCardDragStart(ev) {
    dragTaskId = Number(ev.currentTarget.dataset.taskId);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', String(dragTaskId));
}

function onColDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    ev.currentTarget.classList.add('drag-over');
}

function onColDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const laneKey = ev.currentTarget.dataset.laneKey;
    const id = dragTaskId || Number(ev.dataTransfer.getData('text/plain'));
    if (!id || !laneKey) {
        return;
    }
    const task = state.tasks.find((t) => t.id === id);
    if (!task) {
        return;
    }
    const siblings = [...ev.currentTarget.querySelectorAll('.card')].filter((c) => Number(c.dataset.taskId) !== id);
    const orderedIds = siblings.map((c) => Number(c.dataset.taskId));
    const rect = ev.currentTarget.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    let insertIndex = 0;
    for (let i = 0; i < siblings.length; i++) {
        const cr = siblings[i].getBoundingClientRect();
        const mid = cr.top + cr.height / 2 - rect.top + ev.currentTarget.scrollTop;
        if (y > mid) {
            insertIndex = i + 1;
        }
    }
    const mergedIds = [...orderedIds.slice(0, insertIndex), id, ...orderedIds.slice(insertIndex)];
    const newStatus = resolveStatusAfterLaneMove(task.status, laneKey);
    const boardOrder = boardOrderAmongStatus(mergedIds, id, newStatus);
    moveTask(id, newStatus, boardOrder).catch((e) => toast(String(e.message)));
}

document.addEventListener('dragleave', (ev) => {
    if (ev.target.classList && ev.target.classList.contains('column-body')) {
        ev.target.classList.remove('drag-over');
    }
});

async function moveTask(id, status, boardOrder) {
    await api(`/api/tasks/${id}/move`, {
        method: 'PUT',
        body: JSON.stringify({ status, boardOrder })
    });
    await loadTasks();
    toast('Порядок обновлён');
}

function isoDateOnly(iso) {
    if (!iso) {
        return new Date().toISOString().slice(0, 10);
    }
    if (typeof iso === 'string' && iso.length >= 10) {
        return iso.slice(0, 10);
    }
    return new Date(iso).toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
    const d = new Date(ymd + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Разница в днях по правилам, близким к Frappe Gantt `date_utils.diff(..., 'day')`. */
function diffDaysFrappeLike(dateA, dateB) {
    const ms =
        dateA.getTime() -
        dateB.getTime() +
        (dateB.getTimezoneOffset() - dateA.getTimezoneOffset()) * 60000;
    const days = ms / 1000 / 60 / 60 / 24;
    return Math.round(days * 100) / 100;
}

function parseYmdToLocalDate(ymd) {
    if (!ymd || typeof ymd !== 'string') {
        return null;
    }
    const p = ymd.split('-').map((n) => Number(n));
    if (p.length < 3 || p.some((x) => !Number.isFinite(x))) {
        return null;
    }
    return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
}

/** X координата в системе SVG Ганта (режим Week: step = 7 дней). */
function ganttXForYmd(chart, ymd) {
    const d = parseYmdToLocalDate(ymd);
    const gs = chart?.gantt_start;
    if (!(d instanceof Date) || !gs || !(gs instanceof Date)) {
        return null;
    }
    const diff = diffDaysFrappeLike(d, gs);
    const step = chart.config?.step;
    const cw = chart.config?.column_width;
    if (!step || !cw) {
        return null;
    }
    const x = (diff / step) * cw;
    return Number.isFinite(x) ? x : null;
}

function ganttMilestoneLineColor(t) {
    const hexKey = normalizeHexColor(Array.isArray(t.labels) ? t.labels[0]?.color : null);
    return hexKey ? `#${hexKey}` : '#64748b';
}

function drawGanttMilestoneLines(chart, milestoneItems) {
    if (!chart?.$svg || !milestoneItems?.length) {
        return;
    }
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'gantt-milestone-layer');
    const y1 = chart.config.header_height;
    const y2 = chart.grid_height;
    const w = 2;
    for (const m of milestoneItems) {
        const x = ganttXForYmd(chart, m.date);
        if (x == null) {
            continue;
        }
        const line = document.createElementNS(ns, 'line');
        const xi = Math.round(x) + 0.5;
        line.setAttribute('x1', String(xi));
        line.setAttribute('x2', String(xi));
        line.setAttribute('y1', String(y1));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', m.color || '#64748b');
        line.setAttribute('stroke-width', String(w));
        line.setAttribute('pointer-events', 'none');
        const hint = document.createElementNS(ns, 'title');
        hint.textContent = m.title || 'Веха';
        line.appendChild(hint);
        g.appendChild(line);
    }
    chart.$svg.appendChild(g);
}

function syncTaskFormKindUI() {
    const k = $('#fldKind').value || 'TASK';
    const isMs = k === 'MILESTONE';
    $('#wrapMilestoneDate').classList.toggle('hidden', !isMs);
    $('#wrapPlanDates').classList.toggle('hidden', isMs);
}

function normalizeHexColor(raw) {
    if (raw == null || typeof raw !== 'string') {
        return null;
    }
    let c = raw.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(c)) {
        c = [...c].map((ch) => ch + ch).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(c)) {
        return null;
    }
    return c.toLowerCase();
}

/** CSS для классов вида `.gantt-fill-{hex}` (Frappe: `custom_class` на `.bar-wrapper`). */
function upsertGanttLabelColorStyles(hexSet) {
    const id = 'gantt-dynamic-bar-colors';
    let el = document.getElementById(id);
    const keys = [...hexSet];
    if (keys.length === 0) {
        if (el) {
            el.textContent = '';
        }
        return;
    }
    if (!el) {
        el = document.createElement('style');
        el.id = id;
        document.head.appendChild(el);
    }
    let css = '';
    for (const hex6 of keys) {
        const cls = `gantt-fill-${hex6}`;
        const labelColour = `#${hex6}`;
        /* Frappe: .bar — вся полоса (справа — «осталось»); .bar-progress слева — доля выполнения. */
        css += `.gantt-host .gantt .bar-wrapper.${cls} .bar{fill:#ffffff!important;stroke:rgba(0,0,0,0.12)!important;}\n`;
        css += `.gantt-host .gantt .bar-wrapper.${cls} .bar-progress{fill:${labelColour}!important}\n`;
    }
    el.textContent = css;
}

function renderGantt() {
    const host = $('#ganttHost');
    host.innerHTML = '';
    const GanttCtor = globalThis.Gantt;
    if (typeof GanttCtor !== 'function') {
        host.innerHTML =
            '<div class="gantt-empty hint" style="padding:1rem">Не удалось загрузить библиотеку диаграммы Ганта с CDN — проверьте сеть и блокировку сторонних скриптов.</div>';
        upsertGanttLabelColorStyles(new Set());
        return;
    }
    const chartTasks = tasksForGanttChart();
    const milestoneItems = chartTasks
        .filter((t) => t.kind === 'MILESTONE' && t.milestoneDate)
        .map((t) => ({
            date: t.milestoneDate,
            color: ganttMilestoneLineColor(t),
            title: t.title || 'Веха'
        }));

    const usedHexColors = new Set();
    const rows = [];
    for (const t of chartTasks) {
        if (t.kind === 'MILESTONE') {
            continue;
        }
        let start = t.planStart;
        let end = t.planEnd;
        if (!start) {
            start = isoDateOnly(t.createdAt);
        }
        if (!end) {
            end = addDaysYmd(start, 3);
        }
        if (start > end) {
            end = start;
        }
        const suffix = t.assignee ? ` — ${t.assignee.name}` : '';
        const firstLbl = Array.isArray(t.labels) ? t.labels[0] : null;
        const hexKey = normalizeHexColor(firstLbl?.color);
        if (hexKey) {
            usedHexColors.add(hexKey);
        }
        const row = {
            id: `t_${t.id}`,
            name: t.title + suffix,
            start,
            end,
            progress: ganttProgressForStatus(t.status)
        };
        if (hexKey) {
            row.custom_class = `gantt-fill-${hexKey}`;
        }
        rows.push(row);
    }

    if (rows.length === 0 && milestoneItems.length > 0) {
        const sorted = [...milestoneItems.map((m) => m.date)].sort();
        const s0 = sorted[0];
        const s1 = sorted[sorted.length - 1];
        rows.push({
            id: '__ms_range',
            name: 'Вехи',
            start: s0,
            end: s1 <= s0 ? addDaysYmd(s0, 1) : s1,
            progress: 0,
            custom_class: 'gantt-ms-placeholder'
        });
    }

    if (rows.length === 0 && milestoneItems.length === 0) {
        upsertGanttLabelColorStyles(new Set());
        host.innerHTML = '<div class="gantt-empty hint" style="padding:1rem">Нет задач по текущим фильтрам.</div>';
        return;
    }
    upsertGanttLabelColorStyles(usedHexColors);
    state.gantt = new GanttCtor('#ganttHost', rows, {
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        readonly: true
    });
    drawGanttMilestoneLines(state.gantt, milestoneItems);
}

document.querySelectorAll('.tabs .tab').forEach((btn) =>
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs .tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        state.currentView = view;
        if (view === 'kanban') {
            $('#viewKanban').classList.remove('hidden');
            $('#viewGantt').classList.add('hidden');
            renderBoard();
        } else {
            $('#viewKanban').classList.add('hidden');
            $('#viewGantt').classList.remove('hidden');
            renderGantt();
        }
        syncGanttToolbar();
    })
);

$('#btnApplyFilters').addEventListener('click', () => {
    state.filters.assigneeId = $('#filterAssignee').value || '';
    state.filters.labelIds = [...$('#filterLabelMultiScroll').querySelectorAll('.filter-label-chk:checked')].map((c) =>
        Number(c.value)
    );
    loadTasks().catch((e) => toast(e.message));
});

$('#btnResetFilters').addEventListener('click', () => {
    $('#filterAssignee').value = '';
    $('#filterLabelMultiScroll').querySelectorAll('.filter-label-chk').forEach((c) => {
        c.checked = false;
    });
    state.filters.assigneeId = '';
    state.filters.labelIds = [];
    updateFilterLabelTriggerText();
    loadTasks().catch((e) => toast(e.message));
});

$('#btnGanttToggleCompleted').addEventListener('click', () => {
    state.ganttShowCompleted = !state.ganttShowCompleted;
    syncGanttToolbar();
    if (state.currentView === 'gantt') {
        renderGantt();
    }
});

$('#btnImportTasks').addEventListener('click', () => {
    $('#fldImportJson').value = '';
    $('#importDialog').showModal();
});

$('#btnCancelImport').addEventListener('click', () => $('#importDialog').close());

$('#btnRunImport').addEventListener('click', async () => {
    const raw = $('#fldImportJson').value.trim();
    if (!raw) {
        toast('Вставьте JSON-массив задач');
        return;
    }
    let items;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            toast('Ожидается JSON-массив задач');
            return;
        }
        items = parsed;
    } catch (e) {
        toast('Некорректный JSON: ' + e.message);
        return;
    }
    if (items.length === 0) {
        toast('Массив задач пуст');
        return;
    }
    try {
        const result = await api('/api/tasks/import', { method: 'POST', body: JSON.stringify(items) });
        const parts = [];
        if (result.created) {
            parts.push(`создано: ${result.created}`);
        }
        if (result.updated) {
            parts.push(`обновлено: ${result.updated}`);
        }
        const errList = Array.isArray(result.errors) ? result.errors : [];
        if (parts.length === 0 && errList.length === 0) {
            toast('Ничего не импортировано');
        } else if (errList.length === 0) {
            toast(`Импорт: ${parts.join(', ')}`);
            $('#importDialog').close();
        } else {
            const head = parts.length ? `${parts.join(', ')}, ` : '';
            const preview = errList.slice(0, 3).join('; ');
            const more = errList.length > 3 ? ` … (+${errList.length - 3})` : '';
            toast(`${head}ошибок: ${errList.length}. ${preview}${more}`);
        }
        if (result.created || result.updated) {
            await loadTasks();
        }
    } catch (e) {
        toast(String(e.message));
    }
});

$('#btnRefresh').addEventListener('click', () => {
    Promise.all([loadAssignees(), loadLabels(), loadTasks()]).catch((e) => toast(e.message));
});

$('#btnNewTask').addEventListener('click', () => openTaskDialog(null));

$('#btnCancelTask').addEventListener('click', () => $('#taskDialog').close());

$('#btnSaveTask').addEventListener('click', async () => {
    const payload = collectTaskPayload();
    if (!payload.title?.trim()) {
        toast('Укажите заголовок');
        return;
    }
    if (payload.kind === 'MILESTONE' && !payload.milestoneDate) {
        toast('Укажите контрольную дату для вехи');
        return;
    }
    try {
        const id = $('#taskId').value;
        if (id) {
            await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            toast('Задача сохранена');
        } else {
            await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
            toast('Задача создана');
        }
        $('#taskDialog').close();
        await loadTasks();
        await loadLabels();
    } catch (e) {
        toast(String(e.message));
    }
});

$('#btnDeleteTask').addEventListener('click', async () => {
    const id = $('#taskId').value;
    if (!id || !confirm('Удалить задачу?')) {
        return;
    }
    try {
        await api(`/api/tasks/${id}`, { method: 'DELETE' });
        $('#taskDialog').close();
        toast('Задача удалена');
        await loadTasks();
    } catch (e) {
        toast(String(e.message));
    }
});

$('#btnNewLabelTask').addEventListener('click', () => $('#labelDialog').showModal());

$('#btnCancelLabel').addEventListener('click', () => $('#labelDialog').close());

$('#btnSaveLabel').addEventListener('click', async () => {
    const name = $('#fldLabelName').value.trim();
    if (!name) {
        toast('Введите название метки');
        return;
    }
    const color = $('#fldLabelColor').value;
    try {
        await api('/api/labels', { method: 'POST', body: JSON.stringify({ name, color }) });
        $('#labelDialog').close();
        $('#fldLabelName').value = '';
        toast('Метка создана');
        await loadLabels();
        updateLabelTriggerText();
        updateFilterLabelTriggerText();
    } catch (e) {
        toast(String(e.message));
    }
});

function openAssigneeDialog(target) {
    state.assigneeDialogTarget = target;
    $('#fldAssigneeName').value = '';
    $('#assigneeDialog').showModal();
}

$('#btnNewAssigneeFilter').addEventListener('click', () => openAssigneeDialog('filter'));
$('#btnNewAssigneeTask').addEventListener('click', () => openAssigneeDialog('task'));

$('#btnCancelAssignee').addEventListener('click', () => $('#assigneeDialog').close());

$('#btnSaveAssignee').addEventListener('click', async () => {
    const name = $('#fldAssigneeName').value.trim();
    if (!name) {
        toast('Введите имя исполнителя');
        return;
    }
    try {
        const created = await api('/api/assignees', { method: 'POST', body: JSON.stringify({ name }) });
        $('#assigneeDialog').close();
        toast('Исполнитель добавлен');
        await loadAssignees();
        if (state.assigneeDialogTarget === 'filter') {
            $('#filterAssignee').value = String(created.id);
            state.filters.assigneeId = String(created.id);
        } else {
            $('#fldAssignee').value = String(created.id);
        }
    } catch (e) {
        toast(String(e.message));
    }
});

function collectTaskPayload() {
    const checked = [...$('#labelMultiScroll').querySelectorAll('.label-multi-chk:checked')].map((c) => Number(c.value));
    const aid = $('#fldAssignee').value;
    const kind = $('#fldKind').value || 'TASK';
    const payload = {
        title: $('#fldTitle').value.trim(),
        description: $('#fldDescription').value || null,
        link: $('#fldLink').value.trim() || null,
        kind,
        status: $('#fldStatus').value,
        assigneeId: aid ? Number(aid) : null,
        labelIds: checked
    };
    if (kind === 'MILESTONE') {
        payload.milestoneDate = $('#fldMilestoneDate').value || null;
        payload.planStart = null;
        payload.planEnd = null;
    } else {
        payload.milestoneDate = null;
        payload.planStart = $('#fldPlanStart').value || null;
        payload.planEnd = $('#fldPlanEnd').value || null;
    }
    return payload;
}

function openTaskDialog(t) {
    $('#taskDialogTitle').textContent = t ? 'Редактирование задачи' : 'Новая задача';
    $('#taskId').value = t ? String(t.id) : '';
    $('#fldTitle').value = t?.title || '';
    $('#fldDescription').value = t?.description || '';
    $('#fldLink').value = t?.link || '';
    $('#fldKind').value = t && t.kind === 'MILESTONE' ? 'MILESTONE' : 'TASK';
    $('#fldMilestoneDate').value = t?.milestoneDate || '';
    syncTaskFormKindUI();
    const st = t?.status || DEFAULT_TASK_STATUS;
    $('#fldStatus').value = [...$('#fldStatus').options].some((o) => o.value === st) ? st : DEFAULT_TASK_STATUS;
    const aid = t?.assignee?.id != null ? String(t.assignee.id) : '';
    fillAssigneeSelect($('#fldAssignee'), aid, 'Не назначен');
    $('#fldPlanStart').value = t?.planStart || '';
    $('#fldPlanEnd').value = t?.planEnd || '';
    buildLabelMultiList();
    const selected = new Set((t?.labels || []).map((l) => String(l.id)));
    $('#labelMultiScroll').querySelectorAll('.label-multi-chk').forEach((c) => {
        c.checked = selected.has(String(c.value));
    });
    $('#labelMultiSearch').value = '';
    $('#labelMultiScroll').querySelectorAll('.label-multi-row').forEach((row) => {
        row.style.display = '';
    });
    updateLabelTriggerText();
    toggleLabelDropdown(false);
    $('#btnDeleteTask').style.display = t ? 'inline-block' : 'none';
    $('#taskDialog').showModal();
}

bindLabelMultiOnce();
bindFilterLabelMultiOnce();
$('#fldKind').addEventListener('change', syncTaskFormKindUI);

fillTaskStatusSelect();
syncGanttToolbar();
Promise.all([loadAssignees(), loadLabels(), loadTasks()]).catch((e) => toast(String(e.message)));
