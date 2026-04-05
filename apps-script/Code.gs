const SHEET_NAME = 'Responses';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents);
    validatePayload_(payload);

    const sheet = getOrCreateSheet_();
    ensureHeaders_(sheet);

    if (responseExists_(sheet, payload.responseId)) {
      return jsonResponse_({ ok: true, duplicate: true });
    }

    sheet.appendRow([
      payload.responseId,
      payload.respondentId,
      payload.sessionId,
      payload.studyVersion,
      payload.taskId,
      payload.taskIndex,
      payload.timestamp,
      payload.choiceAB,
      payload.selectedOption,
      payload.finalChoice,
      payload.profileA.price,
      payload.profileA.brand,
      payload.profileA.capacity,
      payload.profileA.laptopSleeve,
      payload.profileA.style,
      payload.profileB.price,
      payload.profileB.brand,
      payload.profileB.capacity,
      payload.profileB.laptopSleeve,
      payload.profileB.style,
      JSON.stringify(payload.profileA),
      JSON.stringify(payload.profileB),
      JSON.stringify(payload.chosenProfile),
      payload.seed,
      payload.deviceType,
      payload.userAgent
    ]);

    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || 'Unknown error' });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }

  sheet.appendRow([
    'response_id',
    'respondent_id',
    'session_id',
    'study_version',
    'task_id',
    'task_index',
    'timestamp',
    'choice_ab',
    'selected_option',
    'final_choice',
    'price_a',
    'brand_a',
    'capacity_a',
    'laptop_sleeve_a',
    'style_a',
    'price_b',
    'brand_b',
    'capacity_b',
    'laptop_sleeve_b',
    'style_b',
    'profile_a_json',
    'profile_b_json',
    'chosen_profile_json',
    'seed',
    'device_type',
    'user_agent'
  ]);
}

function responseExists_(sheet, responseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return false;
  }

  const responseIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  return responseIds.includes(responseId);
}

function validatePayload_(payload) {
  const required = [
    'responseId',
    'respondentId',
    'sessionId',
    'studyVersion',
    'taskId',
    'taskIndex',
    'timestamp',
    'choiceAB',
    'selectedOption',
    'finalChoice',
    'profileA',
    'profileB',
    'chosenProfile',
    'seed'
  ];

  required.forEach(function(field) {
    if (!payload[field]) {
      throw new Error('Missing required field: ' + field);
    }
  });

  ['price', 'brand', 'capacity', 'laptopSleeve', 'style'].forEach(function(field) {
    if (!payload.profileA[field] || !payload.profileB[field]) {
      throw new Error('Profile data missing field: ' + field);
    }
  });

  if (!['A', 'B'].includes(payload.choiceAB)) {
    throw new Error('choiceAB must be A or B.');
  }

  if (!['selected_product', 'neither'].includes(payload.finalChoice)) {
    throw new Error('finalChoice must be selected_product or neither.');
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
