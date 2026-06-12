
(() => {
  const MONTHS_ES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const CAL_DOW = ["L", "M", "M", "J", "V", "S", "D"];
  const WEATHER_ICONS = {
    sun: "SUN",
    "cloud-sun": "PART",
    cloud: "CLOUD",
    fog: "FOG",
    drizzle: "DRIZZLE",
    rain: "RAIN",
    snow: "SNOW",
    storm: "STORM",
  };

  const state = {
    page: document.body?.dataset.page || "",
    monthCursor: new Date(),
    monthDots: new Map(),
    todayPayload: null,
    adaptPayload: null,
    apartados: [],
    tareas: [],
    selectedApartadoId: null,
    weekStart: null,
    weekPayload: null,
    config: null,
    poolSelectedTaskId: null,
    poolSearchQuery: "",
    poolCollapsed: {},
  };

  let _reorderDragSrcPlanId = null;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toIsoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseIsoDate(text) {
    const [y, m, d] = String(text || "").split("-").map((x) => Number(x));
    if (!y || !m || !d) {
      return null;
    }
    return new Date(y, m - 1, d);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  async function api(path, options = {}) {
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };
    if (config.method === "GET" || config.method === "HEAD") {
      delete config.headers;
    }

    const response = await fetch(path, config);
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function openModal(id) {
    const node = document.getElementById(id);
    if (node) {
      node.classList.add("open");
    }
  }

  function closeModal(id) {
    const node = document.getElementById(id);
    if (node) {
      node.classList.remove("open");
    }
  }

  function wireModalEvents() {
    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.getAttribute("data-close-modal");
        if (modalId) {
          closeModal(modalId);
        }
      });
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          overlay.classList.remove("open");
        }
      });
    });
  }

  function setupClock() {
    const dateNode = document.getElementById("date-display");
    const timeNode = document.getElementById("time-display");
    if (!dateNode && !timeNode) {
      return;
    }

    const tick = () => {
      const now = new Date();
      if (dateNode) {
        dateNode.textContent = `${DAYS_ES[now.getDay()]} ${now.getDate()} de ${MONTHS_ES[now.getMonth()]}`;
      }
      if (timeNode) {
        timeNode.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }
    };

    tick();
    setInterval(tick, 1000);
  }

  async function loadWeather() {
    const weatherNode = document.getElementById("weather-pill");
    if (!weatherNode) {
      return;
    }

    try {
      const data = await api("/api/clima");
      const icon = WEATHER_ICONS[data.icon] || WEATHER_ICONS.cloud;
      const temp = data.temperature_c === null || data.temperature_c === undefined ? "--" : `${Math.round(data.temperature_c)}C`;
      weatherNode.textContent = `${icon} ${data.location} ${temp}`;
    } catch {
      weatherNode.textContent = "CLOUD Baigorria --C";
    }
  }

  function showSimpleAlert(message) {
    window.alert(message);
  }

  async function executeAction(tipo, valor) {
    if (tipo === "url") {
      window.open(valor, "_blank");
      return;
    }

    try {
      await api("/api/accion/ejecutar", {
        method: "POST",
        body: JSON.stringify({ tipo, valor }),
      });
    } catch (error) {
      showSimpleAlert(`No se pudo ejecutar accion: ${error.message}`);
    }
  }

  function setProgress(progress) {
    const fill = document.getElementById("progress-fill");
    const text = document.getElementById("progress-pct");
    if (!fill || !text) {
      return;
    }
    const pct = progress?.pct || 0;
    fill.style.width = `${pct}%`;
    text.textContent = `${pct}%`;
  }

  function getTimelineHourPx() {
    const cssValue = getComputedStyle(document.documentElement).getPropertyValue("--tl-hour-px").trim();
    const parsed = Number.parseFloat(cssValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 64;
  }

  function wireTimelineTaskActions(container) {
    container.querySelectorAll(".js-task-toggle").forEach((node) => {
      node.addEventListener("click", async (event) => {
        event.stopPropagation();
        const planId = Number(node.getAttribute("data-plan-id"));
        if (!planId) {
          return;
        }
        try {
          await api("/api/tarea-completada", {
            method: "POST",
            body: JSON.stringify({ plan_dia_id: planId }),
          });
          await loadToday();
        } catch (error) {
          showSimpleAlert(`No se pudo actualizar tarea: ${error.message}`);
        }
      });
    });

    container.querySelectorAll(".js-action").forEach((node) => {
      node.addEventListener("click", async (event) => {
        event.stopPropagation();
        const tipo = node.getAttribute("data-type");
        const valor = node.getAttribute("data-value");
        if (!tipo || !valor) {
          return;
        }
        await executeAction(tipo, valor);
      });
    });

    const closeTaskActionPanels = (exceptBlock = null) => {
      container.querySelectorAll(".tl2-block.actions-open").forEach((block) => {
        if (exceptBlock && block === exceptBlock) {
          return;
        }
        block.classList.remove("actions-open");
        const panel = block.querySelector(".tl2-task-actions");
        if (panel) {
          panel.hidden = true;
        }
        const toggle = block.querySelector(".js-task-actions-toggle");
        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
          toggle.textContent = "Acciones";
        }
      });
    };

    container.querySelectorAll(".js-task-actions-toggle").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        const block = node.closest(".tl2-block");
        if (!block) {
          return;
        }
        const panel = block.querySelector(".tl2-task-actions");
        if (!panel) {
          return;
        }
        const willOpen = !block.classList.contains("actions-open");
        closeTaskActionPanels(willOpen ? block : null);
        block.classList.toggle("actions-open", willOpen);
        panel.hidden = !willOpen;
        node.setAttribute("aria-expanded", willOpen ? "true" : "false");
        node.textContent = willOpen ? "Cerrar" : "Acciones";
      });
    });
  }

  function layoutTimelineBlocks(blocks, dayStart, dayEnd) {
    const visible = (blocks || [])
      .map((item) => {
        const rawStart = Number(item.start_hour);
        const rawEnd = Number(item.end_hour);
        const safeStart = Number.isFinite(rawStart) ? rawStart : dayStart;
        const safeEndBase = Number.isFinite(rawEnd) ? rawEnd : safeStart + 1;
        const safeEnd = safeEndBase <= safeStart ? safeStart + 1 : safeEndBase;
        const visibleStart = Math.max(dayStart, safeStart);
        const visibleEnd = Math.min(dayEnd, safeEnd);
        return {
          ...item,
          _start: safeStart,
          _end: safeEnd,
          _visible_start: visibleStart,
          _visible_end: visibleEnd,
        };
      })
      .filter((item) => item._visible_end > item._visible_start)
      .sort(
        (a, b) =>
          a._start - b._start ||
          b._end - a._end ||
          Number(a.plan_dia_id || 0) - Number(b.plan_dia_id || 0)
      );

    const clusters = [];
    let currentCluster = null;
    visible.forEach((item) => {
      if (!currentCluster || item._start >= currentCluster.end) {
        currentCluster = { end: item._end, items: [item] };
        clusters.push(currentCluster);
        return;
      }
      currentCluster.items.push(item);
      currentCluster.end = Math.max(currentCluster.end, item._end);
    });

    const placed = [];
    clusters.forEach((cluster) => {
      const lanes = [];
      const withLane = [];
      cluster.items
        .sort((a, b) => a._start - b._start || a._end - b._end)
        .forEach((item) => {
          let laneIndex = lanes.findIndex((laneEnd) => laneEnd <= item._start);
          if (laneIndex === -1) {
            laneIndex = lanes.length;
            lanes.push(item._end);
          } else {
            lanes[laneIndex] = item._end;
          }
          withLane.push({ ...item, _lane: laneIndex });
        });
      const laneCount = Math.max(1, lanes.length);
      withLane.forEach((item) => {
        placed.push({ ...item, _lane_count: laneCount });
      });
    });

    return placed.sort((a, b) => a._visible_start - b._visible_start || a._lane - b._lane);
  }

  function renderTimelineV2(payload, body) {
    const dayStart = Number(payload?.day_start);
    const dayEnd = Number(payload?.day_end);
    if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) {
      body.innerHTML = '<div class="empty-state">Rango horario invalido.</div>';
      return;
    }

    const source = payload?.timeline_v2 || {};
    const hourPx = getTimelineHourPx();
    const totalHours = dayEnd - dayStart;
    const blocks = layoutTimelineBlocks(source.blocks || [], dayStart, dayEnd);
    const overflow = Array.isArray(source.overflow) ? source.overflow : [];
    if (blocks.length === 0 && overflow.length === 0) {
      body.innerHTML = '<div class="empty-state">No hay tareas para hoy.</div>';
      return;
    }

    const rows = [];
    for (let hour = dayStart; hour < dayEnd; hour += 1) {
      rows.push(`
        <div class="tl2-hour-row" id="hour-${hour}">
          <div class="tl2-hour">${pad(hour)}</div>
          <div class="tl2-hour-track"></div>
        </div>
      `);
    }
    rows.push(`
      <div class="tl2-hour-row tl2-hour-row-end" id="hour-${dayEnd}">
        <div class="tl2-hour">${pad(dayEnd)}</div>
        <div class="tl2-hour-track"></div>
      </div>
    `);

    const blocksHtml = blocks
      .map((item) => {
        const lane = Math.max(0, Number(item._lane || 0));
        const laneCount = Math.max(1, Number(item._lane_count || 1));
        const top = (item._visible_start - dayStart) * hourPx + 3;
        // Mantiene escala temporal real para evitar superposicion entre bloques contiguos.
        const height = Math.max(44, (item._visible_end - item._visible_start) * hourPx - 6);
        const startHour = Number(item.start_hour);
        const endHour = Number(item.end_hour);
        const actionsHtml = (item.actions || [])
          .map(
            (action) =>
              `<button class="act-btn js-action" data-type="${esc(action.tipo)}" data-value="${esc(action.valor)}">${esc(action.label)}</button>`
          )
          .join("");
        const isCompactBlock = Number(item.duration_hours || item.pomos || 1) <= 1;
        const blockClasses = ["tl2-block", item.done ? "done-row" : "", isCompactBlock ? "tl2-block-compact" : ""]
          .filter(Boolean)
          .join(" ");
        const hasActions = actionsHtml.length > 0;
        const actionsToggle = hasActions
          ? '<button type="button" class="tl2-actions-toggle js-task-actions-toggle" aria-expanded="false">Acciones</button>'
          : "";
        const actionPanel = hasActions ? `<div class="tl2-task-actions" hidden>${actionsHtml}</div>` : "";

        return `
          <article
            class="${blockClasses}"
            data-plan-id="${item.plan_dia_id}"
            style="top:${top}px;height:${height}px;--lane:${lane};--lane-count:${laneCount};--block-color:${esc(item.apartado_color)}"
          >
            <div class="task-check ${item.done ? "done" : ""} js-task-toggle" data-plan-id="${item.plan_dia_id}"></div>
            <div class="tl2-block-main">
              <div class="tl2-block-top">
                <span class="tl2-task-name">${esc(item.task_name)}${(Number(item.repeticiones) || 1) > 1 ? ` <span class="rep-badge">${Number(item.repeticiones)}x</span>` : ""}</span>
                <span class="pomo-tag">${Number(item.duration_hours || item.pomos) || 1}h</span>
              </div>
              <div class="tl2-block-meta">
                <span class="tl2-time">${pad(startHour)}:00-${pad(endHour)}:00</span>
                <span class="prio-badge prio-${Number(item.priority) || 3}">P${Number(item.priority) || 3}</span>
                <span class="tl2-apartado"><span class="tl2-apartado-dot" style="background:${esc(item.apartado_color)}"></span>${esc(item.apartado_name)}</span>
                ${actionsToggle}
              </div>
              ${actionPanel}
            </div>
          </article>
        `;
      })
      .join("");

    const overflowHtml =
      overflow.length === 0
        ? ""
        : `
          <section class="tl2-overflow">
            <div class="tl2-overflow-head">Fuera de jornada</div>
            ${overflow
              .map((item) => {
                const actionsHtml = (item.actions || [])
                  .map(
                    (action) =>
                      `<button class="act-btn js-action" data-type="${esc(action.tipo)}" data-value="${esc(action.valor)}">${esc(action.label)}</button>`
                  )
                  .join("");
                return `
                  <article class="tl2-overflow-item ${item.done ? "done-row" : ""}" data-plan-id="${item.plan_dia_id}">
                    <div class="task-check ${item.done ? "done" : ""} js-task-toggle" data-plan-id="${item.plan_dia_id}"></div>
                    <div class="tl2-overflow-main">
                      <div class="tl2-overflow-title">${esc(item.task_name)}</div>
                      <div class="tl2-overflow-meta">${pad(Number(item.start_hour))}:00-${pad(Number(item.end_hour))}:00 · ${Number(item.duration_hours || item.pomos) || 1}h · P${Number(item.priority) || 3}</div>
                    </div>
                    <div class="task-actions">${actionsHtml}</div>
                  </article>
                `;
              })
              .join("")}
          </section>
        `;

    body.innerHTML = `
      <div class="timeline-v2">
        <div class="tl2-grid" id="tl2-grid" style="--grid-hours:${totalHours}">
          ${rows.join("")}
          <div class="tl2-block-layer" id="tl2-block-layer">
            ${blocksHtml}
          </div>
        </div>
        ${overflowHtml}
      </div>
    `;

    wireTimelineTaskActions(body);
  }

  function renderTimelineLegacy(payload, body) {
    if (!payload || !Array.isArray(payload.timeline) || payload.timeline.length === 0) {
      body.innerHTML = '<div class="empty-state">No hay tareas para hoy.</div>';
      return;
    }

    const html = payload.timeline
      .map((slot) => {
        const blocksHtml = slot.blocks
          .map((block) => {
            const doneCount = block.tasks.filter((task) => task.done).length;
            const totalPomos = block.tasks.reduce((acc, task) => acc + Number(task.pomos || 0), 0);
            const tasksHtml = block.tasks
              .map((task) => {
                const actionsHtml = (task.actions || [])
                  .map(
                    (action) =>
                      `<button class="act-btn js-action" data-type="${esc(action.tipo)}" data-value="${esc(action.valor)}">${esc(action.label)}</button>`
                  )
                  .join("");

                return `
                  <div class="task-row ${task.done ? "done-row" : ""}" data-plan-id="${task.plan_dia_id}">
                    <div class="task-check ${task.done ? "done" : ""} js-task-toggle" data-plan-id="${task.plan_dia_id}"></div>
                    <span class="task-name">${esc(task.name)}</span>
                    <span class="prio-badge prio-${Number(task.priority) || 3}">P${Number(task.priority) || 3}</span>
                    <span class="pomo-tag">${Number(task.pomos) || 1}h</span>
                    <div class="task-actions">${actionsHtml}</div>
                  </div>
                `;
              })
              .join("");

            return `
              <div class="block" data-block-id="${block.id}">
                <div class="block-header js-toggle-block" data-block-id="${block.id}">
                  <span class="block-dot" style="background:${esc(block.color)}"></span>
                  <span class="block-name">${esc(block.name)}</span>
                  <span class="block-meta">${doneCount}/${block.tasks.length} · ${totalPomos}h</span>
                  <span class="block-chevron">></span>
                </div>
                <div class="block-tasks">${tasksHtml}</div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="tl-row" id="hour-${slot.hour}">
            <div class="tl-hour">${pad(slot.hour)}</div>
            <div class="tl-content" id="cnt-${slot.hour}">${blocksHtml}</div>
          </div>
        `;
      })
      .join("");

    body.innerHTML = html;

    body.querySelectorAll(".js-toggle-block").forEach((node) => {
      node.addEventListener("click", () => {
        const wrap = node.closest(".block");
        if (wrap) {
          wrap.classList.toggle("collapsed");
        }
      });
    });

    wireTimelineTaskActions(body);
  }

  function renderTimeline(payload) {
    const body = document.getElementById("timeline-body");
    if (!body) {
      return;
    }

    const hasV2 = Array.isArray(payload?.timeline_v2?.blocks);
    if (hasV2) {
      renderTimelineV2(payload, body);
      return;
    }

    renderTimelineLegacy(payload, body);
  }

  function updateNowLine() {
    document.querySelectorAll(".now-line").forEach((node) => node.remove());
    const payload = state.todayPayload;
    if (!payload) {
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < payload.day_start || hour > payload.day_end) {
      return;
    }

    const v2Layer = document.getElementById("tl2-block-layer");
    if (v2Layer) {
      const dayStart = Number(payload.day_start);
      const dayEnd = Number(payload.day_end);
      const totalHours = Math.max(1, dayEnd - dayStart);
      const nowHours = hour + minute / 60;
      if (nowHours < dayStart || nowHours > dayEnd) {
        return;
      }

      const line = document.createElement("div");
      line.className = "now-line now-line-v2";
      const offset = Math.min(totalHours * getTimelineHourPx(), Math.max(0, (nowHours - dayStart) * getTimelineHourPx()));
      line.style.top = `${offset}px`;
      line.innerHTML = `<div class="now-dot"></div><span class="now-label">${pad(hour)}:${pad(minute)}</span>`;
      v2Layer.appendChild(line);
      return;
    }

    const container = document.getElementById(`cnt-${hour}`);
    if (!container) {
      return;
    }

    const line = document.createElement("div");
    line.className = "now-line";
    line.style.top = `${(minute / 60) * Math.max(container.offsetHeight, 40)}px`;
    line.innerHTML = `<div class="now-dot"></div><span class="now-label">${pad(hour)}:${pad(minute)}</span>`;
    container.appendChild(line);
  }

  function scrollToCurrentHour() {
    const panel = document.getElementById("right-panel");
    if (!panel) {
      return;
    }

    const currentRow = document.getElementById(`hour-${new Date().getHours()}`);
    if (currentRow) {
      panel.scrollTop = Math.max(0, currentRow.offsetTop - 90);
    }
  }

  async function loadToday() {
    try {
      const payload = await api("/api/tareas-hoy");
      state.todayPayload = payload;
      const titleNode = document.getElementById("day-title");
      if (titleNode) {
        titleNode.textContent = payload.day_title;
      }
      renderTimeline(payload);
      setProgress(payload.progress);
      updateNowLine();
      scrollToCurrentHour();
    } catch (error) {
      const body = document.getElementById("timeline-body");
      if (body) {
        body.innerHTML = `<div class="empty-state">Error cargando timeline: ${esc(error.message)}</div>`;
      }
    }
  }

  async function loadMonthDots() {
    try {
      const data = await api(`/api/plan?month=${monthKey(state.monthCursor)}`);
      state.monthDots = new Map((data.days || []).map((row) => [row.fecha, row.total]));
    } catch {
      state.monthDots = new Map();
    }
    renderCalendar();
  }

  function renderCalendar() {
    const nameNode = document.getElementById("cal-month-name");
    const gridNode = document.getElementById("cal-grid");
    if (!nameNode || !gridNode) {
      return;
    }

    const year = state.monthCursor.getFullYear();
    const month = state.monthCursor.getMonth();
    const today = new Date();

    nameNode.textContent = `${MONTHS_ES[month]} ${year}`;

    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;

    const parts = [];
    CAL_DOW.forEach((dow) => parts.push(`<div class="cal-dow">${dow}</div>`));

    for (let i = 0; i < offset; i += 1) {
      parts.push('<div class="cal-day" style="visibility:hidden"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
      const classes = ["cal-day"];
      if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        classes.push("today");
      }
      if (state.monthDots.has(iso)) {
        classes.push("has-dot");
      }
      parts.push(`<div class="${classes.join(" ")}">${day}</div>`);
    }

    gridNode.innerHTML = parts.join("");
  }

  function renderReminders(reminders) {
    const listNode = document.getElementById("reminder-list");
    if (!listNode) {
      return;
    }

    if (!reminders || reminders.length === 0) {
      listNode.innerHTML = '<div class="empty-state">No hay recordatorios para este mes.</div>';
      return;
    }

    listNode.innerHTML = reminders
      .map((item) => {
        const date = parseIsoDate(item.fecha);
        const dateLabel = date ? `${pad(date.getDate())} ${MONTHS_ES[date.getMonth()].slice(0, 3)}` : item.fecha;
        return `
          <div class="reminder-item">
            <span class="rem-badge">${esc(dateLabel)}</span>
            <span class="rem-text">${esc(item.texto)}</span>
            <button class="rem-delete js-rem-delete" data-id="${item.id}">×</button>
          </div>
        `;
      })
      .join("");

    listNode.querySelectorAll(".js-rem-delete").forEach((node) => {
      node.addEventListener("click", async () => {
        const reminderId = Number(node.getAttribute("data-id"));
        if (!reminderId) {
          return;
        }
        try {
          await api(`/api/recordatorios/${reminderId}`, { method: "DELETE" });
          await loadReminders();
        } catch (error) {
          showSimpleAlert(`No se pudo borrar recordatorio: ${error.message}`);
        }
      });
    });
  }

  async function loadReminders() {
    try {
      const reminders = await api(`/api/recordatorios?month=${monthKey(state.monthCursor)}`);
      renderReminders(reminders);
    } catch (error) {
      const listNode = document.getElementById("reminder-list");
      if (listNode) {
        listNode.innerHTML = `<div class="empty-state">Error recordatorios: ${esc(error.message)}</div>`;
      }
    }
  }

  function renderAdaptPlan(payload) {
    const nowNode = document.getElementById("modal-now");
    const remNode = document.getElementById("modal-remaining");
    const planNode = document.getElementById("adapt-plan-box");
    if (!nowNode || !remNode || !planNode) {
      return;
    }

    nowNode.textContent = payload.now;
    remNode.textContent = `${payload.hours_remaining}h`;

    if (!payload.suggested || payload.suggested.length === 0) {
      planNode.innerHTML = '<div class="modal-plan-head">Sin sugerencias</div><div class="modal-plan-row"><span class="mp-task">No hay tareas pendientes que entren en el horario restante.</span></div>';
      return;
    }

    const totalPomos = payload.suggested.reduce((acc, item) => acc + Number(item.task.pomos || 1), 0);
    planNode.innerHTML = `
      <div class="modal-plan-head">Plan sugerido · ${totalPomos}h</div>
      ${payload.suggested
        .map(
          (item) => `
            <div class="modal-plan-row">
              <span class="mp-dot" style="background:${esc(item.apartado.color)}"></span>
              <span class="mp-cat">${esc(item.apartado.name)}</span>
              <span class="mp-task">${esc(item.task.name)}</span>
              <span class="mp-pomo">${Number(item.task.pomos)}h · P${Number(item.task.priority)}</span>
            </div>
          `
        )
        .join("")}
    `;
  }

  async function openAdaptModal() {
    try {
      const payload = await api("/api/adaptar-plan");
      state.adaptPayload = payload;
      renderAdaptPlan(payload);
      openModal("adapt-modal");
    } catch (error) {
      showSimpleAlert(`No se pudo adaptar plan: ${error.message}`);
    }
  }

  async function applyAdaptPlan() {
    try {
      await api("/api/adaptar-plan?apply=1");
      closeModal("adapt-modal");
      await loadToday();
      await loadMonthDots();
    } catch (error) {
      showSimpleAlert(`No se pudo aplicar adaptacion: ${error.message}`);
    }
  }

  async function saveReminder() {
    const dateInput = document.getElementById("reminder-date");
    const textInput = document.getElementById("reminder-text");
    if (!dateInput || !textInput) {
      return;
    }

    const fecha = dateInput.value;
    const texto = textInput.value.trim();
    if (!fecha || !texto) {
      showSimpleAlert("Completa fecha y texto.");
      return;
    }

    try {
      await api("/api/recordatorios", {
        method: "POST",
        body: JSON.stringify({ fecha, texto }),
      });
      textInput.value = "";
      closeModal("reminder-modal");
      await loadReminders();
    } catch (error) {
      showSimpleAlert(`No se pudo guardar recordatorio: ${error.message}`);
    }
  }

  async function initDashboard() {
    await loadWeather();
    setInterval(loadWeather, 15 * 60 * 1000);

    const prevBtn = document.getElementById("cal-prev");
    const nextBtn = document.getElementById("cal-next");
    prevBtn?.addEventListener("click", async () => {
      state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() - 1, 1);
      await loadMonthDots();
      await loadReminders();
    });
    nextBtn?.addEventListener("click", async () => {
      state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + 1, 1);
      await loadMonthDots();
      await loadReminders();
    });

    document.getElementById("add-reminder-btn")?.addEventListener("click", () => {
      const dateInput = document.getElementById("reminder-date");
      if (dateInput) {
        dateInput.value = toIsoDate(new Date());
      }
      openModal("reminder-modal");
    });

    document.getElementById("save-reminder-btn")?.addEventListener("click", saveReminder);
    document.getElementById("adapt-btn")?.addEventListener("click", openAdaptModal);
    document.getElementById("adapt-apply-btn")?.addEventListener("click", applyAdaptPlan);

    await loadToday();
    await loadMonthDots();
    await loadReminders();
    setInterval(updateNowLine, 60 * 1000);
  }

  function resetApartadoForm() {
    const id = document.getElementById("apartado-id");
    const nombre = document.getElementById("apartado-nombre");
    const color = document.getElementById("apartado-color");
    const orden = document.getElementById("apartado-orden");
    if (id) id.value = "";
    if (nombre) nombre.value = "";
    if (color) color.value = "#7a9e87";
    if (orden) orden.value = "0";
  }

  function resetTaskForm() {
    const id = document.getElementById("task-id");
    const nombre = document.getElementById("task-nombre");
    const prioridad = document.getElementById("task-prioridad");
    const pomodoros = document.getElementById("task-pomodoros");
    if (id) id.value = "";
    if (nombre) nombre.value = "";
    if (prioridad) prioridad.value = "2";
    if (pomodoros) pomodoros.value = "1";
  }

  function renderApartados() {
    const list = document.getElementById("apartado-list");
    if (!list) {
      return;
    }

    if (state.apartados.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay apartados.</div>';
      return;
    }

    list.innerHTML = state.apartados
      .map(
        (apartado) => `
          <div class="apartado-item ${state.selectedApartadoId === apartado.id ? "active" : ""}" data-apartado-id="${apartado.id}">
            <span class="color-dot" style="background:${esc(apartado.color)}"></span>
            <button class="apartado-name icon-btn js-select-apartado" data-id="${apartado.id}">${esc(apartado.nombre)}</button>
            <span class="tag-mini">#${apartado.orden}</span>
            <button class="icon-btn js-edit-apartado" data-id="${apartado.id}">Editar</button>
            <button class="icon-btn js-delete-apartado" data-id="${apartado.id}">Borrar</button>
          </div>
        `
      )
      .join("");

    list.querySelectorAll(".js-select-apartado").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedApartadoId = Number(btn.getAttribute("data-id"));
        renderApartados();
        renderTasks();
      });
    });

    list.querySelectorAll(".js-edit-apartado").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const item = state.apartados.find((apartado) => apartado.id === id);
        if (!item) {
          return;
        }
        document.getElementById("apartado-id").value = String(item.id);
        document.getElementById("apartado-nombre").value = item.nombre;
        document.getElementById("apartado-color").value = item.color;
        document.getElementById("apartado-orden").value = String(item.orden ?? 0);
      });
    });

    list.querySelectorAll(".js-delete-apartado").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        if (!id || !window.confirm("Borrar apartado y todo su contenido?")) {
          return;
        }
        try {
          await api(`/api/apartados/${id}`, { method: "DELETE" });
          await loadBibliotecaData();
        } catch (error) {
          showSimpleAlert(`No se pudo borrar apartado: ${error.message}`);
        }
      });
    });
  }

  function renderTasks() {
    const list = document.getElementById("task-list");
    const title = document.getElementById("selected-apartado-title");
    const badge = document.getElementById("task-count-badge");
    if (!list || !title || !badge) {
      return;
    }

    const apartado = state.apartados.find((item) => item.id === state.selectedApartadoId);
    if (!apartado) {
      title.textContent = "Tareas";
      badge.textContent = "0 tareas";
      list.innerHTML = '<div class="empty-state">Selecciona o crea un apartado.</div>';
      return;
    }

    title.textContent = `Tareas · ${apartado.nombre}`;
    const tasks = state.tareas.filter((item) => item.apartado_id === apartado.id);
    badge.textContent = `${tasks.length} tareas`;

    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay tareas en este apartado.</div>';
      return;
    }

    list.innerHTML = tasks
      .map(
        (task) => `
          <article class="task-card" data-task-id="${task.id}">
            <div class="task-card-head">
              <span class="task-card-name">${esc(task.nombre)}</span>
              <span class="task-card-meta">P${task.prioridad} · ${task.pomodoros}h</span>
              <button class="icon-btn js-edit-task" data-id="${task.id}">Editar</button>
              <button class="icon-btn js-delete-task" data-id="${task.id}">Borrar</button>
              <button class="icon-btn js-add-action" data-task-id="${task.id}">+ Accion</button>
            </div>
            <div class="task-card-actions">
              ${(task.actions || [])
                .map(
                  (action) => `
                    <span class="action-pill" data-action-id="${action.id}">
                      ${esc(action.label)} [${esc(action.tipo)}]
                      <button class="js-run-action" data-type="${esc(action.tipo)}" data-value="${esc(action.valor)}">Abrir</button>
                      <button class="js-edit-action" data-action-id="${action.id}" data-task-id="${task.id}">Editar</button>
                      <button class="js-delete-action" data-action-id="${action.id}">X</button>
                    </span>
                  `
                )
                .join("")}
            </div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll(".js-edit-task").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = Number(btn.getAttribute("data-id"));
        const task = state.tareas.find((item) => item.id === taskId);
        if (!task) {
          return;
        }
        document.getElementById("task-id").value = String(task.id);
        document.getElementById("task-nombre").value = task.nombre;
        document.getElementById("task-prioridad").value = String(task.prioridad);
        document.getElementById("task-pomodoros").value = String(task.pomodoros);
      });
    });

    list.querySelectorAll(".js-delete-task").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = Number(btn.getAttribute("data-id"));
        if (!taskId || !window.confirm("Borrar tarea?")) {
          return;
        }
        try {
          await api(`/api/tareas/${taskId}`, { method: "DELETE" });
          await loadBibliotecaData();
        } catch (error) {
          showSimpleAlert(`No se pudo borrar tarea: ${error.message}`);
        }
      });
    });

    list.querySelectorAll(".js-add-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = Number(btn.getAttribute("data-task-id"));
        openActionModal(taskId);
      });
    });

    list.querySelectorAll(".js-edit-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const actionId = Number(btn.getAttribute("data-action-id"));
        const taskId = Number(btn.getAttribute("data-task-id"));
        const task = state.tareas.find((item) => item.id === taskId);
        const action = task?.actions?.find((item) => item.id === actionId);
        if (!action) {
          return;
        }
        openActionModal(taskId, action);
      });
    });

    list.querySelectorAll(".js-delete-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const actionId = Number(btn.getAttribute("data-action-id"));
        if (!actionId || !window.confirm("Borrar accion?")) {
          return;
        }
        try {
          await api(`/api/acciones/${actionId}`, { method: "DELETE" });
          await loadBibliotecaData();
        } catch (error) {
          showSimpleAlert(`No se pudo borrar accion: ${error.message}`);
        }
      });
    });

    list.querySelectorAll(".js-run-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tipo = btn.getAttribute("data-type");
        const valor = btn.getAttribute("data-value");
        if (!tipo || !valor) {
          return;
        }
        await executeAction(tipo, valor);
      });
    });
  }

  function openActionModal(taskId, action = null) {
    document.getElementById("action-task-id").value = String(taskId);
    document.getElementById("action-id").value = action ? String(action.id) : "";
    document.getElementById("action-label").value = action ? action.label : "";
    document.getElementById("action-tipo").value = action ? action.tipo : "url";
    document.getElementById("action-valor").value = action ? action.valor : "";
    openModal("action-modal");
  }

  async function loadBibliotecaData() {
    try {
      const [apartados, tareas] = await Promise.all([api("/api/apartados"), api("/api/tareas")]);
      state.apartados = apartados;
      state.tareas = tareas;
      if (!state.selectedApartadoId && apartados.length) {
        state.selectedApartadoId = apartados[0].id;
      }
      if (!apartados.some((item) => item.id === state.selectedApartadoId)) {
        state.selectedApartadoId = apartados[0]?.id || null;
      }
      renderApartados();
      renderTasks();
    } catch (error) {
      showSimpleAlert(`Error cargando biblioteca: ${error.message}`);
    }
  }

  async function initBiblioteca() {
    document.getElementById("apartado-reset-btn")?.addEventListener("click", resetApartadoForm);
    document.getElementById("apartado-cancel-btn")?.addEventListener("click", resetApartadoForm);
    document.getElementById("task-cancel-btn")?.addEventListener("click", resetTaskForm);

    document.getElementById("apartado-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = Number(document.getElementById("apartado-id").value || 0);
      const payload = {
        nombre: document.getElementById("apartado-nombre").value.trim(),
        color: document.getElementById("apartado-color").value,
        orden: Number(document.getElementById("apartado-orden").value || 0),
      };

      try {
        if (id) {
          await api(`/api/apartados/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await api("/api/apartados", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        resetApartadoForm();
        await loadBibliotecaData();
      } catch (error) {
        showSimpleAlert(`No se pudo guardar apartado: ${error.message}`);
      }
    });

    document.getElementById("task-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.selectedApartadoId) {
        showSimpleAlert("Selecciona un apartado primero.");
        return;
      }

      const taskId = Number(document.getElementById("task-id").value || 0);
      const payload = {
        apartado_id: state.selectedApartadoId,
        nombre: document.getElementById("task-nombre").value.trim(),
        prioridad: Number(document.getElementById("task-prioridad").value || 2),
        pomodoros: Number(document.getElementById("task-pomodoros").value || 1),
      };

      try {
        if (taskId) {
          await api(`/api/tareas/${taskId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await api("/api/tareas", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        resetTaskForm();
        await loadBibliotecaData();
      } catch (error) {
        showSimpleAlert(`No se pudo guardar tarea: ${error.message}`);
      }
    });

    document.getElementById("save-action-btn")?.addEventListener("click", async () => {
      const actionId = Number(document.getElementById("action-id").value || 0);
      const payload = {
        tarea_id: Number(document.getElementById("action-task-id").value || 0),
        label: document.getElementById("action-label").value.trim(),
        tipo: document.getElementById("action-tipo").value,
        valor: document.getElementById("action-valor").value.trim(),
      };

      if (!payload.tarea_id || !payload.label || !payload.tipo || !payload.valor) {
        showSimpleAlert("Completa todos los campos de la accion.");
        return;
      }

      try {
        if (actionId) {
          await api(`/api/acciones/${actionId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await api("/api/acciones", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        closeModal("action-modal");
        await loadBibliotecaData();
      } catch (error) {
        showSimpleAlert(`No se pudo guardar accion: ${error.message}`);
      }
    });

    await loadBibliotecaData();
  }

  function mondayOf(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const delta = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + delta);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function shiftDays(dateIso, amount) {
    const date = parseIsoDate(dateIso);
    if (!date) {
      return toIsoDate(mondayOf(new Date()));
    }
    date.setDate(date.getDate() + amount);
    return toIsoDate(date);
  }

  async function loadConfig() {
    try {
      const cfg = await api("/api/config");
      state.config = cfg;
      document.getElementById("config-day-start").value = String(cfg.day_start);
      document.getElementById("config-day-end").value = String(cfg.day_end);
      document.getElementById("config-city").value = cfg.ciudad;
      document.getElementById("config-lat").value = String(cfg.lat);
      document.getElementById("config-lon").value = String(cfg.lon);
    } catch (error) {
      const node = document.getElementById("config-error");
      if (node) {
        node.textContent = `No se pudo cargar configuracion: ${error.message}`;
      }
    }
  }

  async function saveConfig(event) {
    event.preventDefault();
    const payload = {
      day_start: Number(document.getElementById("config-day-start").value || 6),
      day_end: Number(document.getElementById("config-day-end").value || 22),
      ciudad: document.getElementById("config-city").value.trim(),
      lat: Number(document.getElementById("config-lat").value || -32.85),
      lon: Number(document.getElementById("config-lon").value || -60.73),
    };

    try {
      await api("/api/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const node = document.getElementById("config-error");
      if (node) {
        node.textContent = "";
      }
    } catch (error) {
      const node = document.getElementById("config-error");
      if (node) {
        node.textContent = error.message;
      }
    }
  }

  async function loadWeek() {
    try {
      const [week, tasks, apartados] = await Promise.all([
        api(`/api/plan?week_start=${state.weekStart}`),
        api("/api/tareas"),
        api("/api/apartados"),
      ]);
      state.weekPayload = week;
      state.tareas = tasks;
      state.apartados = apartados;
      renderWeek();
    } catch (error) {
      const grid = document.getElementById("week-grid");
      if (grid) {
        grid.innerHTML = `<div class="empty-state">Error semana: ${esc(error.message)}</div>`;
      }
    }
  }

  async function addTaskToDay(taskId, dateIso) {
    try {
      await api("/api/plan", {
        method: "POST",
        body: JSON.stringify({ tarea_id: taskId, fecha: dateIso }),
      });
      state.poolSelectedTaskId = null;
      await loadWeek();
    } catch (error) {
      if (error.message && error.message.includes("409")) {
        showSimpleAlert("Tarea ya asignada ese dia");
      } else {
        showSimpleAlert(`No se pudo asignar tarea: ${error.message}`);
      }
    }
  }

  function clearPoolSelection() {
    state.poolSelectedTaskId = null;
    document.querySelectorAll(".pool-chip.selected").forEach((el) => el.classList.remove("selected"));
    document.querySelectorAll(".day-column.click-target").forEach((el) => el.classList.remove("click-target"));
  }

  function renderTaskPool() {
    const container = document.getElementById("pool-groups");
    if (!container) return;

    const grouped = {};
    for (const task of state.tareas) {
      const aId = task.apartado_id;
      if (!grouped[aId]) grouped[aId] = [];
      grouped[aId].push(task);
    }

    const apartadoMap = {};
    for (const a of state.apartados) {
      apartadoMap[a.id] = a;
    }

    let chipIndex = 0;
    container.innerHTML = Object.keys(grouped)
      .map((aId) => {
        const ap = apartadoMap[aId] || { nombre: "Sin apartado", color: "#999" };
        const tasks = grouped[aId];
        const isCollapsed = state.poolCollapsed[aId];
        const chipsHtml = tasks
          .map((t) => {
            const delay = chipIndex * 0.04;
            chipIndex++;
            const matchesSearch =
              !state.poolSearchQuery ||
              t.nombre.toLowerCase().includes(state.poolSearchQuery);
            return `
              <div class="pool-chip${matchesSearch ? "" : " hidden"}"
                   draggable="true"
                   data-task-id="${t.id}"
                   data-task-name="${esc(t.nombre.toLowerCase())}"
                   style="border-left-color:${esc(ap.color)}; animation-delay:${delay}s">
                <span class="pool-chip-name">${esc(t.nombre)}</span>
                <span class="pool-chip-badges">
                  <span class="pool-chip-prio prio-${t.prioridad}">P${t.prioridad}</span>
                  <span class="pool-chip-hours">${t.pomodoros}h</span>
                </span>
              </div>
            `;
          })
          .join("");

        return `
          <div class="pool-group${isCollapsed ? " collapsed" : ""}" data-apartado-id="${aId}">
            <div class="pool-group-header" style="border-left-color:${esc(ap.color)}">
              <span class="pool-group-chevron">▼</span>
              <span class="pool-group-name">${esc(ap.nombre)}</span>
              <span class="pool-group-count">${tasks.length}</span>
            </div>
            <div class="pool-group-body">${chipsHtml}</div>
          </div>
        `;
      })
      .join("");

    // Wire collapse
    container.querySelectorAll(".pool-group-header").forEach((header) => {
      header.addEventListener("click", () => {
        const group = header.closest(".pool-group");
        const aId = group.dataset.apartadoId;
        state.poolCollapsed[aId] = !state.poolCollapsed[aId];
        group.classList.toggle("collapsed");
      });
    });

    // Wire drag on chips
    container.querySelectorAll(".pool-chip").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", chip.dataset.taskId);
        e.dataTransfer.effectAllowed = "copy";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        document.querySelectorAll(".day-column.drag-over").forEach((col) => col.classList.remove("drag-over"));
      });

      // Click-to-add
      chip.addEventListener("click", () => {
        const taskId = Number(chip.dataset.taskId);
        if (state.poolSelectedTaskId === taskId) {
          clearPoolSelection();
          return;
        }
        clearPoolSelection();
        state.poolSelectedTaskId = taskId;
        chip.classList.add("selected");
        document.querySelectorAll(".day-column").forEach((col) => col.classList.add("click-target"));
      });
    });
  }

  function renderWeek() {
    const grid = document.getElementById("week-grid");
    if (!grid || !state.weekPayload) {
      return;
    }

    grid.innerHTML = state.weekPayload.days
      .map((day) => {
        const date = parseIsoDate(day.date);
        const dateLabel = date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}` : day.date;
        const totalHours = day.tasks.reduce((sum, t) => sum + (t.pomos || 0) * (t.repeticiones || 1), 0);
        const tasksHtml = day.tasks.length
          ? day.tasks
              .map((task) => {
                const reps = Number(task.repeticiones) || 1;
                const totalH = (task.pomos || 1) * reps;
                const repsBadge = reps > 1 ? `<span class="rep-badge">${reps}x</span>` : "";
                return `
                  <div class="day-task" draggable="true" data-plan-id="${task.plan_dia_id}" style="border-left-color:${esc(task.apartado.color)}">
                    <div class="day-task-top">
                      <span class="day-task-name">${esc(task.name)}</span>${repsBadge}
                      <div class="day-task-rep-controls">
                        <button class="js-rep-dec" data-plan-id="${task.plan_dia_id}" data-reps="${reps}"${reps <= 1 ? " disabled" : ""}>−</button>
                        <button class="js-rep-inc" data-plan-id="${task.plan_dia_id}" data-reps="${reps}">+</button>
                      </div>
                      <button class="day-task-remove js-remove-plan" data-plan-id="${task.plan_dia_id}">×</button>
                    </div>
                    <div class="day-task-meta">${esc(task.apartado.name)} · P${task.priority} · ${totalH}h</div>
                  </div>
                `;
              })
              .join("")
          : '<div class="empty-state">Sin tareas asignadas.</div>';

        return `
          <article class="day-column" data-date="${day.date}">
            <div class="day-head">
              <div class="day-name">${esc(day.name)}</div>
              <div class="day-date">${esc(dateLabel)}</div>
              <div class="day-hours">${totalHours}h planificadas</div>
            </div>
            <div class="day-body">
              ${tasksHtml}
            </div>
          </article>
        `;
      })
      .join("");

    // Wire remove buttons
    grid.querySelectorAll(".js-remove-plan").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const planId = Number(btn.getAttribute("data-plan-id"));
        if (!planId) return;
        try {
          await api(`/api/plan/${planId}`, { method: "DELETE" });
          await loadWeek();
        } catch (error) {
          showSimpleAlert(`No se pudo borrar asignacion: ${error.message}`);
        }
      });
    });

    // Wire repeticion buttons
    grid.querySelectorAll(".js-rep-dec, .js-rep-inc").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const planId = Number(btn.getAttribute("data-plan-id"));
        const currentReps = Number(btn.getAttribute("data-reps")) || 1;
        const delta = btn.classList.contains("js-rep-inc") ? 1 : -1;
        const newReps = Math.max(1, currentReps + delta);
        if (newReps === currentReps) return;
        try {
          await api(`/api/plan/${planId}`, {
            method: "PATCH",
            body: JSON.stringify({ repeticiones: newReps }),
          });
          await loadWeek();
        } catch (error) {
          showSimpleAlert(`No se pudo actualizar repeticiones: ${error.message}`);
        }
      });
    });

    // Wire internal task reordering within a day
    grid.querySelectorAll(".day-task").forEach((taskEl) => {
      taskEl.addEventListener("dragstart", (e) => {
        _reorderDragSrcPlanId = Number(taskEl.dataset.planId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(_reorderDragSrcPlanId));
        setTimeout(() => taskEl.classList.add("dragging"), 0);
      });

      taskEl.addEventListener("dragend", () => {
        _reorderDragSrcPlanId = null;
        taskEl.classList.remove("dragging");
        grid.querySelectorAll(".day-task.drag-over-task").forEach((el) => el.classList.remove("drag-over-task"));
      });

      taskEl.addEventListener("dragover", (e) => {
        if (_reorderDragSrcPlanId === null) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        grid.querySelectorAll(".day-task.drag-over-task").forEach((el) => el.classList.remove("drag-over-task"));
        taskEl.classList.add("drag-over-task");
      });

      taskEl.addEventListener("drop", async (e) => {
        if (_reorderDragSrcPlanId === null) return;
        e.preventDefault();
        e.stopPropagation();
        taskEl.classList.remove("drag-over-task");
        const targetPlanId = Number(taskEl.dataset.planId);
        const srcId = _reorderDragSrcPlanId;
        _reorderDragSrcPlanId = null;
        if (!srcId || srcId === targetPlanId) return;

        const body = taskEl.closest(".day-body");
        const allTasks = [...body.querySelectorAll(".day-task")];
        const ids = allTasks.map((el) => Number(el.dataset.planId));

        const srcIdx = ids.indexOf(srcId);
        const tgtIdx = ids.indexOf(targetPlanId);
        ids.splice(srcIdx, 1);
        ids.splice(tgtIdx, 0, srcId);

        try {
          await api("/api/plan/reorder", {
            method: "POST",
            body: JSON.stringify({ ids }),
          });
          await loadWeek();
        } catch (error) {
          showSimpleAlert(`No se pudo reordenar: ${error.message}`);
        }
      });
    });

    // Wire drag-and-drop on day columns
    grid.querySelectorAll(".day-column").forEach((col) => {
      let dragCounter = 0;

      col.addEventListener("dragover", (e) => {
        if (_reorderDragSrcPlanId !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      });

      col.addEventListener("dragenter", (e) => {
        if (_reorderDragSrcPlanId !== null) return;
        e.preventDefault();
        dragCounter++;
        col.classList.add("drag-over");
      });

      col.addEventListener("dragleave", () => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          col.classList.remove("drag-over");
        }
      });

      col.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        col.classList.remove("drag-over");
        if (_reorderDragSrcPlanId !== null) return;
        const taskId = Number(e.dataTransfer.getData("text/plain"));
        const dateIso = col.dataset.date;
        if (taskId && dateIso) {
          addTaskToDay(taskId, dateIso);
        }
      });

      // Click-to-add on day columns
      col.addEventListener("click", (e) => {
        if (!state.poolSelectedTaskId) return;
        if (e.target.closest(".js-remove-plan")) return;
        if (e.target.closest(".js-rep-dec, .js-rep-inc")) return;
        const dateIso = col.dataset.date;
        if (dateIso) {
          addTaskToDay(state.poolSelectedTaskId, dateIso);
        }
      });
    });

    // Render task pool
    renderTaskPool();
  }

  async function initPlanificacion() {
    const monday = mondayOf(new Date());
    state.weekStart = toIsoDate(monday);

    const weekInput = document.getElementById("week-start-input");
    if (weekInput) {
      weekInput.value = state.weekStart;
    }

    document.getElementById("week-prev")?.addEventListener("click", async () => {
      state.weekStart = shiftDays(state.weekStart, -7);
      weekInput.value = state.weekStart;
      await loadWeek();
    });

    document.getElementById("week-next")?.addEventListener("click", async () => {
      state.weekStart = shiftDays(state.weekStart, 7);
      weekInput.value = state.weekStart;
      await loadWeek();
    });

    document.getElementById("week-go")?.addEventListener("click", async () => {
      if (weekInput?.value) {
        state.weekStart = toIsoDate(mondayOf(parseIsoDate(weekInput.value) || new Date()));
        weekInput.value = state.weekStart;
        await loadWeek();
      }
    });

    document.getElementById("config-form")?.addEventListener("submit", saveConfig);

    // Config drawer toggle
    const configToggle = document.getElementById("config-toggle");
    const configDrawer = document.getElementById("config-drawer");
    if (configToggle && configDrawer) {
      configToggle.addEventListener("click", () => {
        const isOpen = configDrawer.classList.toggle("open");
        configToggle.classList.toggle("active", isOpen);
      });
    }

    // Pool search filter
    document.getElementById("pool-search")?.addEventListener("input", (e) => {
      state.poolSearchQuery = e.target.value.toLowerCase().trim();
      document.querySelectorAll(".pool-chip").forEach((chip) => {
        const name = chip.dataset.taskName || "";
        const matches = !state.poolSearchQuery || name.includes(state.poolSearchQuery);
        chip.classList.toggle("hidden", !matches);
      });
    });

    // Escape to clear pool selection
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.poolSelectedTaskId) {
        clearPoolSelection();
      }
    });

    await loadConfig();
    await loadWeek();
  }

  /* ── Historial ───────────────────────────────── */

  async function initHistorial() {
    state.histYear = new Date().getFullYear();
    state.histData = [];
    state.histSelectedDate = null;

    document.getElementById("hist-prev")?.addEventListener("click", () => {
      state.histYear--;
      loadHistorial();
    });
    document.getElementById("hist-next")?.addEventListener("click", () => {
      state.histYear++;
      loadHistorial();
    });
    document.getElementById("hist-detail-close")?.addEventListener("click", () => {
      document.getElementById("hist-detail").hidden = true;
      state.histSelectedDate = null;
      document.querySelectorAll(".hist-cell.selected").forEach((c) => c.classList.remove("selected"));
    });

    await loadHistorial();
  }

  async function loadHistorial() {
    document.getElementById("hist-year-title").textContent = state.histYear;
    try {
      const res = await fetch(`/api/plan?year=${state.histYear}`);
      const data = await res.json();
      state.histData = data.days || [];
    } catch {
      state.histData = [];
    }
    renderHistStats();
    renderHistHeatmap();
  }

  function renderHistStats() {
    const totalPlanned = state.histData.reduce((s, d) => s + d.total, 0);
    const totalDone = state.histData.reduce((s, d) => s + d.done, 0);
    const rate = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;
    document.getElementById("hist-stats").innerHTML = `
      <div class="hist-stat"><div class="hist-stat-value">${totalPlanned}</div><div class="hist-stat-label">Planificadas</div></div>
      <div class="hist-stat"><div class="hist-stat-value">${totalDone}</div><div class="hist-stat-label">Completadas</div></div>
      <div class="hist-stat"><div class="hist-stat-value">${rate}%</div><div class="hist-stat-label">Tasa</div></div>
    `;
  }

  function renderHistHeatmap() {
    const dayMap = new Map();
    for (const d of state.histData) dayMap.set(d.fecha, d);

    const container = document.getElementById("hist-heatmap");
    container.innerHTML = "";
    const DOW = ["L", "M", "M", "J", "V", "S", "D"];

    for (let m = 0; m < 12; m++) {
      const block = document.createElement("div");
      block.className = "hist-month-block";

      const title = document.createElement("div");
      title.className = "hist-month-name";
      title.textContent = MONTHS_ES[m];
      block.appendChild(title);

      const dowRow = document.createElement("div");
      dowRow.className = "hist-dow-row";
      for (const d of DOW) {
        const span = document.createElement("span");
        span.className = "hist-dow";
        span.textContent = d;
        dowRow.appendChild(span);
      }
      block.appendChild(dowRow);

      const grid = document.createElement("div");
      grid.className = "hist-month-grid";

      const firstDay = new Date(state.histYear, m, 1);
      const daysInMonth = new Date(state.histYear, m + 1, 0).getDate();
      // Monday=0 based padding
      let pad = (firstDay.getDay() + 6) % 7;
      for (let p = 0; p < pad; p++) {
        const cell = document.createElement("div");
        cell.className = "hist-cell empty";
        grid.appendChild(cell);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${state.histYear}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const cell = document.createElement("div");
        cell.className = "hist-cell";
        const info = dayMap.get(dateStr);

        if (!info || info.total === 0) {
          cell.classList.add("level-0");
        } else {
          const ratio = info.done / info.total;
          if (ratio === 0) cell.classList.add("level-none");
          else if (ratio < 0.34) cell.classList.add("level-low");
          else if (ratio < 0.67) cell.classList.add("level-mid");
          else if (ratio < 1) cell.classList.add("level-high");
          else cell.classList.add("level-full");
        }

        cell.title = dateStr + (info ? ` (${info.done}/${info.total})` : "");
        cell.addEventListener("click", () => loadDayDetail(dateStr));
        grid.appendChild(cell);
      }

      block.appendChild(grid);
      container.appendChild(block);
    }
  }

  async function loadDayDetail(fecha) {
    state.histSelectedDate = fecha;
    // Update selection visuals
    document.querySelectorAll(".hist-cell.selected").forEach((c) => c.classList.remove("selected"));
    document.querySelectorAll(".hist-cell").forEach((c) => {
      if (c.title.startsWith(fecha)) c.classList.add("selected");
    });

    const panel = document.getElementById("hist-detail");
    const body = document.getElementById("hist-detail-body");
    document.getElementById("hist-detail-title").textContent = fecha;

    try {
      const res = await fetch(`/api/plan?date=${fecha}`);
      const data = await res.json();
      const tasks = data.tasks || [];

      if (tasks.length === 0) {
        body.innerHTML = '<div class="hist-empty-msg">Sin tareas planificadas</div>';
      } else {
        body.innerHTML = tasks
          .map(
            (t) => `
          <div class="hist-task-row">
            <div class="hist-task-check ${t.done ? "done" : "not-done"}">${t.done ? "&#10003;" : ""}</div>
            <div class="hist-task-color-dot" style="background:${esc(t.apartado.color)}"></div>
            <div class="hist-task-name">${esc(t.name)}${(Number(t.repeticiones) || 1) > 1 ? ` <span class="rep-badge">${Number(t.repeticiones)}x</span>` : ""}</div>
            <span class="hist-task-prio">P${t.priority}</span>
            <span class="hist-task-pomos">${(t.pomos || 0) * (Number(t.repeticiones) || 1)}h</span>
          </div>`
          )
          .join("");
      }
    } catch {
      body.innerHTML = '<div class="hist-empty-msg">Error al cargar</div>';
    }

    panel.hidden = false;
  }

  async function bootstrap() {
    wireModalEvents();
    setupClock();

    if (state.page === "dashboard") {
      await initDashboard();
      return;
    }
    if (state.page === "biblioteca") {
      await initBiblioteca();
      return;
    }
    if (state.page === "planificacion") {
      await initPlanificacion();
      return;
    }
    if (state.page === "historial") {
      await initHistorial();
      return;
    }
  }

  bootstrap();
})();

