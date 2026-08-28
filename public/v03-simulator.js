// Fallback-only buttons for the two v0.3 packet tools.
// Native WebMCP clients discover the registered tools directly. The built-in
// shim exposes executeTool(), which lets ordinary browsers demonstrate them.
setTimeout(() => {
  const host = document.querySelector('#tool-buttons');
  const output = document.querySelector('#tool-output');
  if (!host || typeof document.modelContext?.executeTool !== 'function') return;

  for (const name of ['prepare_application_packet', 'validate_application_packet']) {
    if (host.querySelector(`[data-v03-tool="${name}"]`)) continue;
    const button = document.createElement('button');
    button.className = 'tool-button';
    button.dataset.v03Tool = name;
    button.innerHTML = `<code>${name}</code><span>run →</span>`;
    button.addEventListener('click', async () => {
      const service = document.querySelector('[data-v03-service].active')?.dataset.v03Service || 'kiz';
      output.textContent = 'Running…';
      try {
        const result = await document.modelContext.executeTool({ name }, JSON.stringify({ service }));
        output.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        output.textContent = `Error: ${error.message}`;
      }
    });
    host.appendChild(button);
  }
}, 450);
