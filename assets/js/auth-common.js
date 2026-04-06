window.normalizeText = (v) => String(v ?? '').trim();
window.normalizeAccountStatus = (v) => String(v || '').toLowerCase().trim();
window.escapeHtml = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
