import { archive, BOARDS, DEFAULTS, generate, PROJECT_TEMPLATES } from "./generator.js";
import { guideSteps } from "./guide.js";

const $ = id => document.getElementById(id);
const form = $("recipe-form");
let files = [];
let statusTimer;

function announce(message) {
  clearTimeout(statusTimer);
  $("action-status").textContent = message;
  statusTimer = setTimeout(() => { $("action-status").textContent = ""; }, 6500);
}

function highlight(target, text) {
  target.replaceChildren();
  for (const line of text.split("\n")) {
    if (/^\s*#/.test(line)) {
      const span = document.createElement("span");
      span.className = "token-comment";
      span.textContent = line;
      target.append(span);
    } else {
      const tokens = line.split(/(\$\{[^}]+\}|"[^"]*"|\bdo_(?:compile|install|configure)\b)/g);
      for (const token of tokens) {
        const span = document.createElement("span");
        if (token.startsWith("${")) span.className = "token-variable";
        else if (token.startsWith('"')) span.className = "token-string";
        else if (token.startsWith("do_")) span.className = "token-task";
        span.textContent = token;
        target.append(span);
      }
    }
    target.append(document.createTextNode("\n"));
  }
}

function currentFile() { return files[Number($("file-picker").value)]; }
function previewFile() {
  const file = currentFile();
  highlight($("preview"), file ? file.content : "Fix the highlighted fields to prepare your starter files.");
  $("file-type").textContent = file?.path.endsWith(".bb") ? "BITBAKE RECIPE" : "STARTER FILE";
}

function syncFields() {
  const git = $("source").value === "git";
  $("git-fields").hidden = !git;
  const project = PROJECT_TEMPLATES.includes(form.elements.template.value);
  $("source-file-field").hidden = project;
  $("sourceFile").disabled = project;
  for (const option of document.querySelectorAll("[data-git-only]")) option.disabled = !git;
  if (!git && !["MIT", "CLOSED"].includes($("license").value)) $("license").value = "MIT";
  $("license-fields").hidden = !git || $("license").value === "CLOSED";
}

function update({ focusError = false } = {}) {
  syncFields();
  const data = Object.fromEntries(new FormData(form));
  const result = generate(data);
  const previous = currentFile()?.path;
  files = result.files;
  for (const key of Object.keys(DEFAULTS)) {
    const input = $(key);
    if (!input) continue;
    const error = result.errors[key];
    input.setAttribute("aria-invalid", error ? "true" : "false");
    if ($(`${key}-error`)) $(`${key}-error`).textContent = error || "";
  }
  const count = Object.keys(result.errors).length;
  $("validation-status").textContent = count ? `Fix ${count} ${count === 1 ? "field" : "fields"} to generate safe starter files.` : "";
  $("file-count").textContent = `${files.length} files`;
  $("file-picker").replaceChildren(...files.map((file, index) => {
    const option = document.createElement("option");
    option.value = index; option.textContent = file.path; option.selected = file.path === previous;
    return option;
  }));
  for (const id of ["file-picker", "copy-file", "download-file", "download-all"]) $(id).disabled = count > 0;
  previewFile();
  if (focusError && count) $(Object.keys(result.errors)[0])?.focus();
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`Download requested: ${filename}. Keep each file at the path shown in the preview.`);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    announce("Copied to clipboard.");
  } catch (error) {
    console.error("Clipboard access failed", error);
    announce("Clipboard access is unavailable. Select the preview text and copy it manually.");
  }
}

function showPanel(name, { focus = false } = {}) {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const selected = tab.id === `tab-${name}`;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) $(`tab-${name}`).focus();
  history.replaceState(null, "", `#${name}`);
}

function renderGuide() {
  const completed = new Set([...document.querySelectorAll(".checkpoint input:checked")].map(input => input.dataset.step));
  const steps = guideSteps($("board").value);
  $("guide-nav").replaceChildren();
  $("guide-steps").replaceChildren();
  for (const [index, step] of steps.entries()) {
    const id = `step-${index + 1}`;
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${id}`; link.textContent = step.title; li.append(link);
    $("guide-nav").append(li);
    const article = document.createElement("article");
    article.className = "guide-step"; article.id = id;
    const header = document.createElement("header");
    const number = document.createElement("span"); number.className = "step-number"; number.textContent = index + 1;
    const title = document.createElement("h3"); title.textContent = step.title;
    header.append(number, title); article.append(header);
    const body = document.createElement("div");
    // Only developer-authored guide HTML and allowlisted board constants enter here.
    body.innerHTML = step.html;
    article.append(body);
    const block = document.createElement("div"); block.className = "guide-code";
    const toolbar = document.createElement("div"); toolbar.className = "code-toolbar";
    const language = document.createElement("span"); language.textContent = index === 3 ? "LOCAL.CONF" : "BASH / READ BEFORE RUNNING";
    const copyButton = document.createElement("button");
    copyButton.type = "button"; copyButton.textContent = "Copy";
    copyButton.setAttribute("aria-label", `Copy commands for ${step.title}`);
    copyButton.addEventListener("click", () => copy(step.code));
    toolbar.append(language, copyButton);
    const pre = document.createElement("pre"); pre.tabIndex = 0; pre.setAttribute("aria-label", `Commands for ${step.title}`);
    const code = document.createElement("code"); highlight(code, step.code);
    pre.append(code); block.append(toolbar, pre); article.append(block);
    const label = document.createElement("label"); label.className = "checkpoint";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.dataset.step = String(index);
    checkbox.checked = completed.has(String(index));
    checkbox.addEventListener("change", updateProgress);
    label.append(checkbox, document.createTextNode(step.check)); article.append(label);
    $("guide-steps").append(article);
  }
  for (const el of document.querySelectorAll("[data-board-name]")) el.textContent = BOARDS[$("board").value].name;
  $("machine-label").textContent = $("board").value;
  updateProgress();
}

function updateProgress() {
  const count = document.querySelectorAll(".checkpoint input:checked").length;
  $("progress").value = count;
  $("progress-label").textContent = `${count} of 10 checkpoints completed`;
}

form.addEventListener("input", () => update());
form.addEventListener("change", event => {
  if (event.target.name === "template") {
    $("sourceFile").value = { c: "main.c", cpp: "main.cpp", data: "message.txt" }[event.target.value] || "main.c";
  }
  update();
});
form.addEventListener("submit", event => { event.preventDefault(); update({ focusError: true }); });
$("board").addEventListener("change", () => {
  for (const input of document.querySelectorAll(".checkpoint input")) input.checked = false;
  update(); renderGuide();
  announce("Board changed. Commands updated and checkpoints reset; use a separate build directory for each board.");
});
$("file-picker").addEventListener("change", previewFile);
$("copy-file").addEventListener("click", () => { if (currentFile()) copy(currentFile().content); });
$("download-file").addEventListener("click", () => {
  const file = currentFile();
  if (file) download(file.content, file.path.split("/").at(-1), "text/plain;charset=utf-8");
});
$("download-all").addEventListener("click", () => {
  if (files.length) download(archive(files), `${$("name").value}-starter.tar`, "application/x-tar");
});
$("reset-example").addEventListener("click", () => {
  const board = $("board").value;
  form.reset();
  $("board").value = board;
  update();
  announce("Restored the local C example. Board selection is unchanged.");
});
$("open-guide").addEventListener("click", () => {
  showPanel("guide", { focus: true });
  $("tab-guide").scrollIntoView({ block: "start", behavior: "instant" });
});
for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => showPanel(tab.id.slice(4)));
  tab.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    showPanel(tabs[next].id.slice(4), { focus: true });
  });
}
$("quiz").addEventListener("submit", event => {
  event.preventDefault();
  const answer = new FormData($("quiz")).get("answer");
  $("quiz-result").textContent = !answer ? "Choose an answer first." : answer === "image"
    ? "Exactly. A package build and an image build are different steps. IMAGE_INSTALL chooses what goes into the image."
    : "Not quite. Building a package does not include it automatically. Add it to IMAGE_INSTALL, rebuild the image, then reflash.";
});
function route() {
  const hash = location.hash.slice(1);
  if (/^step-(?:[1-9]|10)$/.test(hash)) {
    showPanel("guide");
    $(hash)?.scrollIntoView();
  } else showPanel(["builder", "guide", "basics"].includes(hash) ? hash : "builder");
}
window.addEventListener("hashchange", route);
update(); renderGuide(); route();
