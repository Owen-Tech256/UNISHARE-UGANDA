// Arcode studio navbar - dropdown + full-screen overlay
// Executes this step of the component interaction.
(function () {
  const root = document.getElementById('arcode-root'); // Finds the required element in the document.
  if (!root) return; // Runs the following logic only when this condition is true.
  const dropdown = root.querySelector('#arcode-activities'); // Finds the required element in the document.
  const trigger = root.querySelector('#arcode-activities-trigger'); // Finds the required element in the document.
  const toggle = root.querySelector('#arcode-nav-toggle'); // Finds the required element in the document.
  const closeBtn = root.querySelector('#arcode-nav-close'); // Finds the required element in the document.
  const overlay = root.querySelector('#arcode-nav-drawer'); // Finds the required element in the document.

  // Stores this value for reuse in the interaction logic.
  const setDropdown = (open) => {
    dropdown.classList.toggle('open', open); // Switches the state class on or off.
    trigger.setAttribute('aria-expanded', String(open)); // Updates the element attribute to match the current state.
    if (open) dropdown.querySelector('a').focus(); // Runs the following logic only when this condition is true.
  // Closes the current callback or control block.
  };
  // Runs the following handler when this browser event occurs.
  trigger.addEventListener('click', () => setDropdown(trigger.getAttribute('aria-expanded') !== 'true'));

  // Stores this value for reuse in the interaction logic.
  const setOverlay = (open) => {
    overlay.classList.toggle('is-open', open); // Switches the state class on or off.
    overlay.setAttribute('aria-hidden', String(!open)); // Updates the element attribute to match the current state.
    toggle.setAttribute('aria-expanded', String(open)); // Updates the element attribute to match the current state.
    // Updates the element attribute to match the current state.
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflow = open ? 'hidden' : ''; // Uses the browser document API to update the page.
    if (open) closeBtn.focus(); // Runs the following logic only when this condition is true.
    else toggle.focus(); // Handles the alternative condition.
  // Closes the current callback or control block.
  };
  // Runs the following handler when this browser event occurs.
  toggle.addEventListener('click', () => setOverlay(toggle.getAttribute('aria-expanded') !== 'true'));
  closeBtn.addEventListener('click', () => setOverlay(false)); // Runs the following handler when this browser event occurs.
  // Runs the following handler when this browser event occurs.
  overlay.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOverlay(false)));

  // Runs the following handler when this browser event occurs.
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) setDropdown(false); // Runs the following logic only when this condition is true.
  // Closes the current callback or control block.
  });
  // Runs the following handler when this browser event occurs.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return; // Runs the following logic only when this condition is true.
    if (overlay.classList.contains('is-open')) setOverlay(false); // Runs the following logic only when this condition is true.
    else if (dropdown.classList.contains('open')) setDropdown(false); // Handles the alternative condition.
  // Closes the current callback or control block.
  });
  // Runs the following handler when this browser event occurs.
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setOverlay(false); });
})(); // Executes this step of the component interaction.