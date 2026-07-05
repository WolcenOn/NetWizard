/* =========================================================
   NetWizard Security Utils v3.48
   Helpers pequeños para reducir riesgos XSS en render HTML.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
/*
Mantenimiento:
- Usar escapeHtml()/escapeAttr() para cualquier dato de proyecto que vaya a innerHTML.
- Preferir textContent cuando no se necesite markup.
- html(strings,...values) escapa interpolaciones por defecto; usar rawHtml() solo para
  fragmentos estáticos o ya escapados por este mismo módulo.
*/
(function initNetWizardSecurityUtils(root){
  'use strict';

  const core = root.NetWizardCoreUtils || {};

  function escapeHtml(value){
    if(core && typeof core.escapeHtml === 'function') return core.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  function escapeAttr(value){
    // En HTML clásico el mismo escape cubre texto y atributos entre comillas.
    return escapeHtml(value);
  }

  function rawHtml(value){
    return { __nwRawHtml: true, value: String(value ?? '') };
  }

  function html(strings, ...values){
    let out = '';
    for(let i=0;i<strings.length;i++){
      out += strings[i];
      if(i < values.length){
        const v = values[i];
        out += v && v.__nwRawHtml ? v.value : escapeHtml(v);
      }
    }
    return out;
  }

  function setSafeText(el, value){
    if(el) el.textContent = String(value ?? '');
  }

  function escapeJsString(value){
    // Para valores embebidos en manejadores inline legacy: oninput="fn('...')".
    // Primero se escapa el literal JS y después debe pasarse por escapeAttr/html.
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ');
  }

  function inlineJsString(value){
    return escapeAttr(escapeJsString(value));
  }

  const api = { version:'netwizard-security-utils-v3.48', escapeHtml, escapeAttr, escapeJsString, inlineJsString, rawHtml, html, setSafeText };
  root.NetWizardSecurityUtils = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
