/* =========================================================
   UniShare Uganda - dropdown.js
   Custom dropdown for <select class="input"> so the open
   option list matches the design palette instead of the
   primitive browser popup.

   Design contract:
   - The native <select> stays in the DOM as the source of
     truth (hidden). All existing JS keeps reading/writing
     select.value, change listeners keep firing, form
     submissions are untouched.
   - .value / .disabled programmatic sets and dynamic
     <option> rebuilds are trapped (property trap +
     MutationObserver) so the visual trigger stays in sync.
   - The listbox renders at document.body level with fixed
     positioning so it is never clipped by modal
     overflow (edit modals contain selects).
   ========================================================= */

(function () {
  "use strict";

  /* ---------- helpers ---------- */

  function labelFor(select) {
    const opt = select.options[select.selectedIndex];
    return opt ? opt.text : "";
  }

  function isPlaceholder(select) {
    const opt = select.options[select.selectedIndex];
    return !opt || opt.value === "";
  }

  /* ---------- open listboxes ---------- */

  /* Every enhanced select registers a close() here so that closing
     one dropdown fully tears down every other open instance (state,
     listeners, aria) — never leaving a stale internal list reference. */
  const registry = new Set();

  function closeAllLists() {
    registry.forEach(inst => inst.close());
  }

  /* ---------- enhancement ---------- */

  function enhance(select) {
    if (select.dataset.ddEnhanced) return;
    select.dataset.ddEnhanced = "1";
    select.classList.add("dd-native"); /* CSS hides it */

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dd-trigger input";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const labelText = document.querySelector(`label[for="${select.id}"]`);
    trigger.setAttribute("aria-label",
      (labelText ? labelText.textContent.trim() : "") || select.name || "Select an option");
    trigger.innerHTML = '<span class="dd-label"></span>';
    select.insertAdjacentElement("afterend", trigger);

    /* --- trap programmatic .value / .disabled sets --- */
    const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(select, "value", {
      get() { return valueDesc.get.call(select); },
      set(v) { valueDesc.set.call(select, v); syncTrigger(); }
    });
    const disabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "disabled");
    Object.defineProperty(select, "disabled", {
      get() { return disabledDesc.get.call(select); },
      set(v) { disabledDesc.set.call(select, v); syncTrigger(); }
    });
    const idxDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
    Object.defineProperty(select, "selectedIndex", {
      get() { return idxDesc.get.call(select); },
      set(v) { idxDesc.set.call(select, v); syncTrigger(); }
    });

    function syncTrigger() {
      trigger.querySelector(".dd-label").textContent = labelFor(select);
      trigger.classList.toggle("is-placeholder", isPlaceholder(select));
      trigger.classList.toggle("has-error", select.classList.contains("has-error"));
      trigger.disabled = select.disabled;
    }

    /* --- listbox --- */
    let list = null;
    let activeIndex = -1;
    let optionEls = [];

    function buildOptions() {
      list.innerHTML = "";
      optionEls = [];
      Array.from(select.options).forEach((opt, i) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "dd-option" +
          (opt.disabled ? " dd-disabled" : "") +
          (opt.value === "" ? " dd-placeholder" : "") +
          (i === select.selectedIndex ? " dd-selected" : "");
        el.setAttribute("role", "option");
        el.setAttribute("aria-selected", i === select.selectedIndex ? "true" : "false");
        el.innerHTML = `<span>${opt.text}</span>`;
        el.addEventListener("click", () => choose(opt.value));
        list.appendChild(el);
        optionEls.push(el);
      });
    }

    function position() {
      const rect = trigger.getBoundingClientRect();
      list.style.minWidth = rect.width + "px";
      list.style.left = rect.left + "px";
      list.style.top = "";            /* measure natural height first */
      list.style.visibility = "hidden";
      list.style.display = "block";
      const h = list.offsetHeight;
      const below = window.innerHeight - rect.bottom;
      if (below < h + 12 && rect.top > h + 12) {
        list.style.top = (rect.top - h - 6) + "px";   /* open upward */
      } else {
        list.style.top = (rect.bottom + 6) + "px";
      }
      list.style.visibility = "";
    }

    function setActive(i) {
      if (!optionEls.length) return;
      activeIndex = Math.max(0, Math.min(i, optionEls.length - 1));
      optionEls.forEach((el, idx) => el.classList.toggle("dd-active", idx === activeIndex));
      optionEls[activeIndex].scrollIntoView({ block: "nearest" });
    }

    const instance = { close: () => close() };
    registry.add(instance);

    function open() {
      if (select.disabled || list) return;
      closeAllLists();
      list = document.createElement("div");
      list.className = "dd-listbox";
      list.setAttribute("role", "listbox");
      buildOptions();
      document.body.appendChild(list);
      position();
      trigger.setAttribute("aria-expanded", "true");

      setActive(select.selectedIndex >= 0 ? select.selectedIndex : 0);

      /* Attach synchronously: a capture-phase listener added on document
         during the target phase cannot fire for the current event, so the
         opening click cannot self-close. Avoids the stale-timer race that
         a setTimeout attach would introduce with rapid open/close. */
      document.addEventListener("click", onDocClick, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", close);
    }

    function close() {
      if (!list) return;
      list.remove(); list = null;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    }

    function onDocClick(e) {
      if (!list) return; /* stale dispatch after a synchronous close */
      if (!list.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close();
    }
    function onScroll() { close(); }

    function choose(value) {
      const opt = Array.from(select.options).find(o => o.value === value);
      if (!opt || opt.disabled) return;
      valueDesc.set.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncTrigger();
      close();
      trigger.focus();
    }

    /* --- interactions (single state-machine handler) --- */
    trigger.addEventListener("click", () => (list ? close() : open()));
    trigger.addEventListener("keydown", (e) => {
      const navKeys = ["ArrowDown", "ArrowUp", "Enter", " "];
      if (navKeys.includes(e.key)) e.preventDefault();

      if (!list) {                       /* closed: open */
        if (navKeys.includes(e.key)) open();
        return;
      }
      /* open: navigate / choose / dismiss */
      if (e.key === "Escape") { close(); trigger.focus(); }
      else if (e.key === "ArrowDown") setActive(activeIndex + 1);
      else if (e.key === "ArrowUp") setActive(activeIndex - 1);
      else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(optionEls.length - 1);
      else if (e.key === "Enter" || e.key === " ") {
        const opt = Array.from(select.options)[activeIndex];
        if (opt) choose(opt.value);
      }
    });

    /* --- keep in sync with external changes --- */
    new MutationObserver(() => {
      syncTrigger();
      if (list) buildOptions();
    }).observe(select, { childList: true, attributes: true, attributeFilter: ["class", "disabled"] });

    syncTrigger();
  }

  /* ---------- public + auto-init ---------- */

  function enhanceAll(root) {
    (root || document).querySelectorAll("select.input:not([data-dd-enhanced])").forEach(enhance);
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceAll();
    /* selects added to the DOM later (dynamic modals etc.) */
    new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches("select.input")) enhance(n);
        if (n.querySelectorAll) n.querySelectorAll("select.input:not([data-dd-enhanced])").forEach(enhance);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  });

  window.UniDropdown = { enhance: enhanceAll };
})();
