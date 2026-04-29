const STATUS_COLUMNS = [
    { status: 'TODO', title: 'К выполнению' },
    { status: 'IN_PROGRESS', title: 'В работе' },
    { status: 'REVIEW', title: 'Проверка' },
    { status: 'DONE', title: 'Готово' }
];

const state = {
    tasks: [],
    labels: [],
    assignees: [],
    filters: { assigneeId: '', labelId: '' },
    assigneeDialogTarget: 'filter',
    gantt: null,
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
    const lid = state.filters.labelId;
    if (aid) {
        p.set('assigneeId', aid);
    }
    if (lid) {
        p.set('labelId', lid);
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

async function loadLabels() {
    state.labels = await api('/api/labels');
    const sel = $('#filterLabel');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Любая</option>';
    for (const lb of state.labels) {
        const o = document.createElement('option');
        o.value = String(lb.id);
        o.textContent = lb.name;
        sel.appendChild(o);
    }
    sel.value = cur && [...sel.options].some((o) => o.value === cur) ? cur : '';
    buildLabelMultiList();
}

function buildLabelMultiList() {
    const scroll = $('#labelMultiScroll');
    scroll.innerHTML = '';
    for (const lb of state.labels) {
        const row = document.createElement('label');
        row.className = 'label-multi-row';
        row.dataset.name = (lb.name || '').toLowerCase();
        row.innerHTML = `<input type="checkbox" value="${lb.id}" class="label-multi-chk"/> <span style="color:${escapeAttr(lb.color || '#64748b')}">●</span> <span class="label-multi-name">${escapeHtml(lb.name)}</span>`;
        scroll.appendChild(row);
    }
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
    const byStatus = {};
    for (const s of STATUS_COLUMNS) {
        byStatus[s.status] = [];
    }
    for (const t of state.tasks) {
        if (byStatus[t.status]) {
            byStatus[t.status].push(t);
        }
    }
    for (const col of STATUS_COLUMNS) {
        const list = byStatus[col.status].sort((a, b) => a.boardOrder - b.boardOrder);
        const wrap = document.createElement('div');
        wrap.className = 'column';
        wrap.dataset.status = col.status;
        wrap.innerHTML = `<div class="column-header"><span>${col.title}</span><span class="pill">${list.length}</span></div>`;
        const body = document.createElement('div');
        body.className = 'column-body';
        body.dataset.status = col.status;
        for (const t of list) {
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
    el.innerHTML = `
    <p class="card-title">${escapeHtml(t.title)}</p>
    <div class="meta">${assigneeHtml} ${tags}</div>
    <div class="card-actions">
      <button type="button" class="btn mini link" data-action="edit">Изменить</button>
    </div>`;
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
    const status = ev.currentTarget.dataset.status;
    const id = dragTaskId || Number(ev.dataTransfer.getData('text/plain'));
    if (!id || !status) {
        return;
    }
    const siblings = [...ev.currentTarget.querySelectorAll('.card')].filter((c) => Number(c.dataset.taskId) !== id);
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
    moveTask(id, status, insertIndex).catch((e) => toast(String(e.message)));
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

function renderGantt() {
    const host = $('#ganttHost');
    host.innerHTML = '';
    const GanttCtor = globalThis.Gantt;
    if (typeof GanttCtor !== 'function') {
        host.innerHTML =
            '<div class="gantt-empty hint" style="padding:1rem">Не удалось загрузить библиотеку диаграммы Ганта с CDN — проверьте сеть и блокировку сторонних скриптов.</div>';
        return;
    }
    const rows = [];
    for (const t of state.tasks) {
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
        rows.push({
            id: `t_${t.id}`,
            name: t.title + suffix,
            start,
            end,
            progress: t.status === 'DONE' ? 100 : Math.min(90, t.status === 'REVIEW' ? 85 : t.status === 'IN_PROGRESS' ? 55 : 10)
        });
    }
    if (rows.length === 0) {
        host.innerHTML = '<div class="gantt-empty hint" style="padding:1rem">Нет задач по текущим фильтрам.</div>';
        return;
    }
    state.gantt = new GanttCtor('#ganttHost', rows, {
        view_mode: 'Week',
        date_format: 'YYYY-MM-DD',
        readonly: true
    });
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
    })
);

$('#btnApplyFilters').addEventListener('click', () => {
    state.filters.assigneeId = $('#filterAssignee').value || '';
    state.filters.labelId = $('#filterLabel').value || '';
    loadTasks().catch((e) => toast(e.message));
});

$('#btnResetFilters').addEventListener('click', () => {
    $('#filterAssignee').value = '';
    $('#filterLabel').value = '';
    state.filters.assigneeId = '';
    state.filters.labelId = '';
    loadTasks().catch((e) => toast(e.message));
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

$('#linkNewLabel').addEventListener('click', (ev) => {
    ev.preventDefault();
    $('#labelDialog').showModal();
});

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
    return {
        title: $('#fldTitle').value.trim(),
        description: $('#fldDescription').value || null,
        status: $('#fldStatus').value,
        assigneeId: aid ? Number(aid) : null,
        planStart: $('#fldPlanStart').value || null,
        planEnd: $('#fldPlanEnd').value || null,
        labelIds: checked
    };
}

function openTaskDialog(t) {
    $('#taskDialogTitle').textContent = t ? 'Редактирование задачи' : 'Новая задача';
    $('#taskId').value = t ? String(t.id) : '';
    $('#fldTitle').value = t?.title || '';
    $('#fldDescription').value = t?.description || '';
    $('#fldStatus').value = t?.status || 'TODO';
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

Promise.all([loadAssignees(), loadLabels(), loadTasks()]).catch((e) => toast(String(e.message)));
