const STUDY_CONFIG = {
  studyVersion: "backpack-v1",
  totalTasks: 7,
  storageKeys: {
    respondentId: "backpack-conjoint.respondent-id",
    sessionState: "backpack-conjoint.session-state",
    pendingSubmissions: "backpack-conjoint.pending-submissions",
  },
  saveEndpoint:
    "https://script.google.com/a/macros/berkeley.edu/s/AKfycby4X4LVVNkNqRgq1-gbsjn13IAQbdXc4wtvcNCK-r1y2pFyu7KhZqpNO-QYabFZD5mPXQ/exec",
  attributes: [
    {
      key: "price",
      label: "Price",
      levels: ["$35", "$60", "$90"],
    },
    {
      key: "brand",
      label: "Brand",
      levels: ["Generic", "North Ridge", "TrailPro"],
    },
    {
      key: "capacity",
      label: "Capacity",
      levels: ["18L", "24L", "30L"],
    },
    {
      key: "laptopSleeve",
      label: "Laptop Sleeve",
      levels: ["No sleeve", "13-inch sleeve", "16-inch padded sleeve"],
    },
    {
      key: "style",
      label: "Style",
      levels: ["Minimal", "Sporty", "Outdoor"],
    },
  ],
};

const state = {
  respondentId: null,
  sessionId: null,
  seed: null,
  tasks: [],
  currentTaskIndex: 0,
  taskChoice: null,
  saving: false,
  completedTaskIds: new Set(),
};

const appRoot = document.getElementById("app");

boot();

async function boot() {
  state.respondentId = getOrCreateRespondentId();
  hydrateSessionState();
  renderWelcome();
  window.addEventListener("online", () => flushPendingSubmissions());
  await flushPendingSubmissions();
}

function getOrCreateRespondentId() {
  const savedId = localStorage.getItem(STUDY_CONFIG.storageKeys.respondentId);
  if (savedId) {
    return savedId;
  }

  const newId = crypto.randomUUID();
  localStorage.setItem(STUDY_CONFIG.storageKeys.respondentId, newId);
  return newId;
}

function hydrateSessionState() {
  const stored = localStorage.getItem(STUDY_CONFIG.storageKeys.sessionState);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.studyVersion === STUDY_CONFIG.studyVersion) {
      state.sessionId = parsed.sessionId;
      state.seed = parsed.seed;
      state.tasks = parsed.tasks;
      state.currentTaskIndex = parsed.currentTaskIndex;
      state.completedTaskIds = new Set(parsed.completedTaskIds || []);
      return;
    }
  }

  startFreshSession();
}

function startFreshSession() {
  state.sessionId = crypto.randomUUID();
  state.seed = crypto.randomUUID();
  state.tasks = generateTaskSet();
  state.currentTaskIndex = 0;
  state.completedTaskIds = new Set();
  persistSessionState();
}

function persistSessionState() {
  localStorage.setItem(
    STUDY_CONFIG.storageKeys.sessionState,
    JSON.stringify({
      studyVersion: STUDY_CONFIG.studyVersion,
      sessionId: state.sessionId,
      seed: state.seed,
      tasks: state.tasks,
      currentTaskIndex: state.currentTaskIndex,
      completedTaskIds: [...state.completedTaskIds],
    })
  );
}

function generateTaskSet() {
  const levelUsage = Object.fromEntries(
    STUDY_CONFIG.attributes.map((attribute) => [
      attribute.key,
      Object.fromEntries(attribute.levels.map((level) => [level, 0])),
    ])
  );

  const tasks = [];
  for (let index = 0; index < STUDY_CONFIG.totalTasks; index += 1) {
    const profileA = generateProfile(levelUsage);
    let profileB = generateProfile(levelUsage);
    let retries = 0;

    while (sameProfile(profileA, profileB) && retries < 20) {
      profileB = generateProfile(levelUsage);
      retries += 1;
    }

    tasks.push({
      taskId: crypto.randomUUID(),
      taskIndex: index + 1,
      profileA,
      profileB,
    });
  }

  return tasks;
}

function generateProfile(levelUsage) {
  const profile = {};

  STUDY_CONFIG.attributes.forEach((attribute) => {
    const levelsByUse = [...attribute.levels].sort((left, right) => {
      const usageGap = levelUsage[attribute.key][left] - levelUsage[attribute.key][right];
      if (usageGap !== 0) {
        return usageGap;
      }
      return Math.random() - 0.5;
    });

    const chosenLevel = levelsByUse[0];
    profile[attribute.key] = chosenLevel;
    levelUsage[attribute.key][chosenLevel] += 1;
  });

  return profile;
}

function sameProfile(profileA, profileB) {
  return STUDY_CONFIG.attributes.every(
    (attribute) => profileA[attribute.key] === profileB[attribute.key]
  );
}

function renderWelcome() {
  if (state.currentTaskIndex >= STUDY_CONFIG.totalTasks) {
    renderCompletion();
    return;
  }

  appRoot.innerHTML = "";
  const template = document.getElementById("welcome-template");
  const node = template.content.cloneNode(true);

  node.querySelector("#respondent-id").textContent = state.respondentId;
  node.querySelector("#study-version").textContent = STUDY_CONFIG.studyVersion;
  node.querySelector("#start-button").addEventListener("click", renderCurrentTask);

  appRoot.appendChild(node);
}

function renderCurrentTask() {
  const task = state.tasks[state.currentTaskIndex];
  if (!task) {
    renderCompletion();
    return;
  }

  state.taskChoice = null;
  appRoot.innerHTML = "";

  const template = document.getElementById("task-template");
  const node = template.content.cloneNode(true);

  node.querySelector("#task-title").textContent = `Task ${task.taskIndex} of ${STUDY_CONFIG.totalTasks}`;
  node.querySelector("#progress-pill").textContent = `${task.taskIndex}/${STUDY_CONFIG.totalTasks}`;
  populateProfileDetails(node.querySelector("#profile-a-details"), task.profileA);
  populateProfileDetails(node.querySelector("#profile-b-details"), task.profileB);

  node.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskChoice = button.dataset.choice;
      updateSelectedProfile(task);
    });
  });

  node.querySelector("#final-choice-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleTaskSubmit(task);
  });

  appRoot.appendChild(node);
}

function populateProfileDetails(container, profile) {
  container.innerHTML = "";
  STUDY_CONFIG.attributes.forEach((attribute) => {
    const dt = document.createElement("dt");
    dt.textContent = attribute.label;
    const dd = document.createElement("dd");
    dd.textContent = profile[attribute.key];
    container.append(dt, dd);
  });
}

function updateSelectedProfile(task) {
  const profileCards = [...appRoot.querySelectorAll(".profile-card")];
  profileCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.option === state.taskChoice);
  });

  const finalChoiceForm = document.getElementById("final-choice-form");
  finalChoiceForm.classList.remove("hidden");

  const selectedLabel = state.taskChoice === "A" ? "Backpack A" : "Backpack B";
  document.getElementById(
    "final-choice-legend"
  ).textContent = `You selected ${selectedLabel}. Would you actually choose it or choose neither?`;

  const status = document.getElementById("save-status");
  status.textContent = "";
  status.className = "save-status";
}

async function handleTaskSubmit(task) {
  if (state.saving) {
    return;
  }

  const selectedFinalChoice = appRoot.querySelector('input[name="final-choice"]:checked');
  if (!state.taskChoice || !selectedFinalChoice) {
    setStatus("Please choose A or B, then choose selected product or neither.", "error");
    return;
  }

  const chosenProfileKey = state.taskChoice === "A" ? "profileA" : "profileB";
  const payload = {
    responseId: crypto.randomUUID(),
    respondentId: state.respondentId,
    sessionId: state.sessionId,
    studyVersion: STUDY_CONFIG.studyVersion,
    taskId: task.taskId,
    taskIndex: task.taskIndex,
    timestamp: new Date().toISOString(),
    choiceAB: state.taskChoice,
    selectedOption: `Backpack ${state.taskChoice}`,
    finalChoice: selectedFinalChoice.value,
    chosenProfile: task[chosenProfileKey],
    profileA: task.profileA,
    profileB: task.profileB,
    seed: state.seed,
    deviceType: getDeviceType(),
    userAgent: navigator.userAgent,
  };

  state.saving = true;
  setSavingUi(true);
  setStatus("Saving task...", "");

  try {
    await submitPayload(payload);
    advanceTask(task.taskId);
    setStatus("Task saved.", "success");

    window.setTimeout(() => {
      if (state.currentTaskIndex >= STUDY_CONFIG.totalTasks) {
        renderCompletion();
      } else {
        renderCurrentTask();
      }
    }, 350);
  } catch (error) {
    queuePendingSubmission(payload);
    advanceTask(task.taskId);
    setStatus(
      "Task stored locally. It will retry automatically when the connection returns.",
      "error"
    );

    window.setTimeout(() => {
      if (state.currentTaskIndex >= STUDY_CONFIG.totalTasks) {
        renderCompletion();
      } else {
        renderCurrentTask();
      }
    }, 500);
  } finally {
    state.saving = false;
    setSavingUi(false);
  }
}

async function submitPayload(payload) {
  if (!STUDY_CONFIG.saveEndpoint || STUDY_CONFIG.saveEndpoint.includes("PASTE_YOUR")) {
    throw new Error("Save endpoint not configured.");
  }

  const response = await fetch(STUDY_CONFIG.saveEndpoint, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || "Save failed.");
  }
}

function queuePendingSubmission(payload) {
  const pending = getPendingSubmissions();
  if (!pending.some((item) => item.responseId === payload.responseId)) {
    pending.push(payload);
    localStorage.setItem(
      STUDY_CONFIG.storageKeys.pendingSubmissions,
      JSON.stringify(pending)
    );
  }
}

function getPendingSubmissions() {
  const stored = localStorage.getItem(STUDY_CONFIG.storageKeys.pendingSubmissions);
  return stored ? JSON.parse(stored) : [];
}

async function flushPendingSubmissions() {
  const pending = getPendingSubmissions();
  if (!pending.length) {
    return;
  }

  const remaining = [];
  for (const payload of pending) {
    try {
      await submitPayload(payload);
    } catch (error) {
      remaining.push(payload);
    }
  }

  localStorage.setItem(
    STUDY_CONFIG.storageKeys.pendingSubmissions,
    JSON.stringify(remaining)
  );
}

function setSavingUi(isSaving) {
  const controls = appRoot.querySelectorAll("button, input");
  controls.forEach((control) => {
    control.disabled = isSaving;
  });
}

function setStatus(message, tone) {
  const status = document.getElementById("save-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = "save-status";
  if (tone) {
    status.classList.add(tone);
  }
}

function renderCompletion() {
  appRoot.innerHTML = "";
  const template = document.getElementById("completion-template");
  const node = template.content.cloneNode(true);
  node.querySelector("#completion-respondent-id").textContent = state.respondentId;
  node.querySelector("#completion-count").textContent = String(
    state.completedTaskIds.size
  );
  appRoot.appendChild(node);
}

function getDeviceType() {
  return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

function advanceTask(taskId) {
  state.completedTaskIds.add(taskId);
  state.currentTaskIndex += 1;
  persistSessionState();
}
