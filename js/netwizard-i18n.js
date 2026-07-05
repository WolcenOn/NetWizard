/* =========================================================
   NetWizard i18n v3.48
   Generado por scripts/i18n-sync.js.

   Mantenimiento:
   - Edita i18n/*.json y i18n/locales.json.
   - Ejecuta npm run i18n:check && npm run i18n:sync.
   - No edites manualmente el objeto dictionaries dentro de este archivo.
   - Las traducciones se renderizan como texto plano para preservar el hardening XSS.
========================================================= */
(function initNetWizardI18n(root){
  'use strict';
  const LOCALE_KEY='nw_locale_v1';
  const REPORT_LOCALE_KEY='nw_report_locale_v1';
  const FALLBACK='es';
  const localeMeta=[
  {
    "code": "es",
    "label": "Español",
    "nativeName": "Español",
    "rtl": false
  },
  {
    "code": "en",
    "label": "English",
    "nativeName": "English",
    "rtl": false
  }
];
  const dictionaries={
  "es": {
    "app.title": "NetWizard Pro",
    "app.version": "NetWizard v3.48 RC",
    "top.project": "Proyecto:",
    "top.saved": "✓ guardado",
    "top.new": "🗑 Nuevo",
    "top.export": "⬆ Exportar",
    "top.uiLanguage": "Idioma UI",
    "top.reportLanguage": "Informes",
    "locale.es": "Español",
    "locale.en": "English",
    "sidebar.sec.start": "Inicio",
    "sidebar.sec.network": "Red",
    "sidebar.sec.visual": "Visualización",
    "sidebar.sec.connectivity": "Conectividad",
    "sidebar.sec.security": "Seguridad",
    "sidebar.sec.export": "Exportar",
    "sidebar.sec.summary": "Resumen",
    "nav.dash": "Panel",
    "nav.wiz": "Asistente",
    "nav.loc": "Ubicaciones",
    "nav.dev": "Dispositivos",
    "nav.ports": "Puertos & Interfaces",
    "nav.vlan": "VLANs & Subnets",
    "nav.hosts": "Hosts & IP Map",
    "nav.iot": "IoT & Gateways",
    "nav.graphs": "Vistas gráficas",
    "nav.links": "Puertos & Enlaces",
    "nav.fw": "Firewall",
    "nav.cfg": "Configuración",
    "dash.title": "🏠 Panel del proyecto",
    "dash.projectName": "Nombre del proyecto",
    "dash.projectPlaceholder": "Red corporativa…",
    "actions.save": "Guardar",
    "actions.cancel": "Cancelar",
    "actions.close": "Cerrar",
    "actions.download": "Descargar",
    "docs.card.title": "📑 Inventario, documentación y matriz",
    "docs.card.badge": "v3.48 i18n",
    "docs.card.desc": "Exporta un inventario operativo del proyecto y revisa una matriz de conectividad entre VLANs antes de producción.",
    "docs.viewMatrix": "Ver matriz",
    "docs.downloadInventory": "Descargar inventario CSV",
    "docs.downloadMatrix": "Descargar matriz CSV",
    "docs.downloadMarkdown": "Descargar documentación Markdown",
    "docs.matrix.empty": "No hay VLANs suficientes para generar matriz.",
    "docs.matrix.title": "Matriz de conectividad entre VLANs",
    "docs.matrix.more": "... {count} filas más. Descarga CSV para ver todo.",
    "doc.title": "Documentación NetWizard — {project}",
    "doc.exported": "Exportado: {date}",
    "doc.summary": "Resumen",
    "doc.devices": "Dispositivos",
    "doc.vlans": "VLANs",
    "doc.ports": "Puertos",
    "doc.links": "Enlaces",
    "doc.hosts": "Hosts",
    "doc.dhcp": "DHCP",
    "doc.firewall": "Firewall",
    "doc.connectivityMatrix": "Matriz de conectividad",
    "doc.notes": "Notas",
    "doc.note.design": "Esta documentación es una ayuda de diseño y debe revisarse antes de producción.",
    "doc.note.review": "Las filas marcadas como `REVIEW`, `ALLOW/REVIEW` o `DENY/REVIEW` requieren validación técnica.",
    "i18n.loaded": "Idioma cargado",
    "pg.card.title": "🚦 Puerta de producción",
    "pg.card.badge": "v3.48 i18n",
    "pg.card.desc": "Validación final agregada antes de exportar o aplicar cambios. Incluye guía de corrección priorizada y checklist exportable.",
    "pg.strict": "Perfil estricto de producción",
    "pg.showGuide": "Mostrar guía de corrección",
    "pg.run": "Ejecutar puerta",
    "pg.guide": "Guía de corrección",
    "pg.downloadChecklist": "Descargar checklist",
    "pg.goExport": "Ir a exportación",
    "pg.guide.empty": "✅ No hay incidencias que requieran corrección con los filtros actuales.",
    "pg.guide.title": "Guía de corrección priorizada",
    "pg.guide.section": "Sección recomendada",
    "pg.guide.why": "Por qué importa",
    "pg.guide.how": "Cómo corregir",
    "pg.guide.shown": "Mostradas {count} incidencias priorizadas. Ajusta filtros o resuelve las primeras y vuelve a ejecutar.",
    "pg.severity.error": "ERROR",
    "pg.severity.warning": "AVISO",
    "pg.severity.info": "INFO",
    "pg.status.ready": "LISTO",
    "pg.status.review": "REQUIERE REVISIÓN",
    "pg.status.blocked": "BLOQUEADO",
    "pg.mode.production": "producción",
    "pg.mode.demo": "demo",
    "pg.mode.strict": "estricto",
    "pg.checklist.title": "Checklist de producción NetWizard",
    "pg.checklist.state": "Estado",
    "pg.checklist.mode": "Modo",
    "pg.checklist.generated": "Generado",
    "pg.checklist.errors": "Errores",
    "pg.checklist.warnings": "Avisos",
    "pg.checklist.info": "Info",
    "pg.checklist.byCategory": "Resumen por categoría",
    "pg.checklist.noIssues": "Sin incidencias.",
    "pg.checklist.recommendedFixes": "Correcciones recomendadas",
    "pg.checklist.noFixes": "No hay correcciones pendientes con los datos actuales.",
    "pg.checklist.message": "Mensaje",
    "pg.checklist.section": "Sección",
    "pg.checklist.why": "Por qué importa",
    "pg.checklist.steps": "Pasos",
    "pg.checklist.exitCriteria": "Criterio de salida",
    "pg.checklist.exit.noBlocked": "La puerta de producción no está BLOQUEADA.",
    "pg.checklist.exit.rulesReviewed": "Las reglas generadas han sido revisadas.",
    "pg.checklist.exit.vendorReviewed": "Las exportaciones vendor han sido revisadas en laboratorio.",
    "pg.checklist.exit.snapshot": "Se conserva snapshot/export JSON antes del despliegue.",
    "matrix.destination.internet": "Internet/WAN",
    "matrix.service.internet": "DNS, HTTP, HTTPS según política",
    "matrix.service.none": "—",
    "matrix.service.local": "local",
    "matrix.service.review": "según necesidad",
    "matrix.reason.internet.allow": "Intención VLAN permite Internet",
    "matrix.reason.internet.deny": "Intención VLAN no declara Internet",
    "matrix.reason.local": "Tráfico dentro de la misma VLAN",
    "matrix.reason.blocked": "Matriz inter-VLAN marcada como bloqueada",
    "matrix.reason.explicit": "Regla firewall explícita",
    "matrix.reason.isolation": "Intención {type} recomienda aislamiento lateral",
    "matrix.reason.management": "VLAN de gestión; confirmar alcance administrativo",
    "matrix.reason.default": "Sin regla explícita; revisar antes de producción",
    "doc.generatedBy": "Generado por NetWizard",
    "doc.auditChecklist": "Checklist de producción",
    "doc.language": "Idioma del informe",
    "actions.add": "Añadir",
    "actions.edit": "Editar",
    "actions.delete": "Eliminar",
    "actions.apply": "Aplicar",
    "actions.preview": "Previsualizar",
    "actions.run": "Ejecutar",
    "actions.validate": "Validar",
    "actions.generate": "Generar",
    "actions.copy": "Copiar",
    "actions.reset": "Resetear",
    "actions.import": "Importar",
    "actions.finish": "Finalizar",
    "actions.next": "Siguiente →",
    "actions.previous": "← Anterior",
    "common.all": "Todos",
    "common.none": "ninguno seleccionado",
    "common.noTitle": "Sin título",
    "common.noDevices": "Sin dispositivos.\nUsa el Asistente para empezar.",
    "common.noVlans": "Sin VLANs",
    "common.noHosts": "Sin hosts",
    "dash.stats.devices": "Dispositivos",
    "dash.stats.rules": "Reglas FW",
    "form.name": "Nombre",
    "form.type": "Tipo",
    "form.vendor": "Vendor",
    "form.model": "Modelo",
    "form.notes": "Notas",
    "form.description": "Descripción",
    "form.device": "Dispositivo",
    "form.port": "Puerto",
    "form.mode": "Modo",
    "form.info": "VLAN/Info",
    "form.ip": "IP",
    "form.mac": "MAC",
    "form.gateway": "Gateway",
    "form.subnet": "Subnet",
    "form.status": "Estado",
    "form.action": "Acción",
    "form.services": "Servicios",
    "form.reason": "Motivo",
    "sections.devices": "Dispositivos",
    "sections.ports": "Puertos",
    "sections.vlans": "VLANs",
    "sections.subnets": "Subnets",
    "sections.hosts": "Hosts",
    "sections.links": "Enlaces",
    "sections.firewall": "Firewall",
    "sections.dhcp": "DHCP",
    "sections.security": "Seguridad",
    "sections.config": "Configuración",
    "i18n.coverage.title": "Cobertura de traducción",
    "i18n.coverage.desc": "Traducción progresiva de interfaz, formularios, informes y mensajes. Las claves internas del proyecto no se traducen.",
    "i18n.audit.noHtml": "Las traducciones se tratan como texto plano para mantener el hardening XSS.",
    "text.Proyecto": "Proyecto:",
    "text.guardado": "✓ guardado",
    "text.Nuevo": "🗑 Nuevo",
    "text.Exportar": "⬆ Exportar",
    "text.Panel": "Panel",
    "text.Asistente": "Asistente",
    "text.Ubicaciones": "Ubicaciones",
    "text.Dispositivos": "Dispositivos",
    "text.Puertos_Interfaces": "Puertos & Interfaces",
    "text.VLANs_Subnets": "VLANs & Subnets",
    "text.Hosts_IP_Map": "Hosts & IP Map",
    "text.IoT_Gateways": "IoT & Gateways",
    "text.Vistas_gr_ficas": "Vistas gráficas",
    "text.Puertos_Enlaces": "Puertos & Enlaces",
    "text.Firewall": "Firewall",
    "text.Configuraci_n": "Configuración",
    "text.Finalizar": "Finalizar",
    "text.Siguiente": "Siguiente →",
    "text.Anterior": "← Anterior",
    "text.Guardar": "Guardar",
    "text.Cancelar": "Cancelar",
    "text.Cerrar": "Cerrar",
    "text.Descargar": "Descargar",
    "text.Nombre": "Nombre",
    "text.Tipo": "Tipo",
    "text.Vendor": "Vendor",
    "text.Modelo": "Modelo",
    "text.Notas": "Notas",
    "text.Descripci_n": "Descripción",
    "text.Dispositivo": "Dispositivo",
    "text.Puerto": "Puerto",
    "text.Modo": "Modo",
    "text.VLAN_Info": "VLAN/Info",
    "text.IP": "IP",
    "text.MAC": "MAC",
    "text.Gateway": "Gateway",
    "text.Estado": "Estado",
    "text.Acci_n": "Acción",
    "text.Servicios": "Servicios",
    "text.Motivo": "Motivo",
    "text.Nombre_del_proyecto": "Nombre del proyecto",
    "text.Red_corporativa": "Red corporativa…",
    "text.Sin_t_tulo": "Sin título",
    "text.Sin_dispositivos_Usa_el_Asistente_para_empezar": "Sin dispositivos.\nUsa el Asistente para empezar.",
    "text.Sin_VLANs": "Sin VLANs",
    "text.Sin_hosts": "Sin hosts",
    "text.Sin_subnet": "Sin subnet",
    "text.Escenario": "Escenario:",
    "text.VLANs": "VLANs:",
    "text.Dispositivos_seleccionados": "Dispositivos seleccionados:",
    "text.ninguno_seleccionado": "(ninguno seleccionado)",
    "text.A_adir": "Añadir",
    "text.Guardar_cambios": "Guardar cambios",
    "text.A_adir_dispositivo": "Añadir dispositivo",
    "text.A_adir_puerto": "Añadir puerto",
    "text.A_adir_VLAN": "Añadir VLAN",
    "text.A_adir_host": "Añadir host",
    "text.Crear_enlace": "Crear enlace",
    "text.Editar": "Editar",
    "text.Eliminar": "Eliminar",
    "text.Todos": "Todos",
    "text.Cambia_el_filtro": "Cambia el filtro.",
    "text.A_ade_puertos_arriba": "Añade puertos arriba.",
    "text.a_ade_un_dispositivo_primero": "— añade un dispositivo primero —",
    "text.access_usuario_host": "access (usuario/host)",
    "text.trunk_uplink_RoaS": "trunk (uplink/RoaS)",
    "text.LAN_trunk_a_switches": "LAN (trunk a switches)",
    "text.WAN_hacia_ISP": "WAN (hacia ISP)",
    "text.routed_L3_directo": "routed (L3 directo)",
    "text.Puerta_de_producci_n": "Puerta de producción",
    "text.Gu_a_de_correcci_n": "Guía de corrección",
    "text.Descargar_checklist": "Descargar checklist",
    "text.Ir_a_exportaci_n": "Ir a exportación",
    "text.Perfil_estricto_de_producci_n": "Perfil estricto de producción",
    "text.Inventario_documentaci_n_y_matriz": "Inventario, documentación y matriz",
    "text.Ver_matriz": "Ver matriz",
    "text.Descargar_inventario_CSV": "Descargar inventario CSV",
    "text.Descargar_matriz_CSV": "Descargar matriz CSV",
    "text.Descargar_documentaci_n_Markdown": "Descargar documentación Markdown",
    "text.Preparaci_n_para_producci_n": "Preparación para producción",
    "text.Modo_de_ejecuci_n": "Modo de ejecución",
    "text.Plan_com_n_de_cambios": "Plan común de cambios",
    "text.Historial_y_snapshots": "Historial y snapshots",
    "text.Auditor_a_L2_avanzada": "Auditoría L2 avanzada",
    "text.Riesgo_broadcast": "Riesgo broadcast",
    "text.Hardening_exportaci_n_vendor": "Hardening exportación vendor",
    "text.Intenci_n_por_VLAN": "Intención por VLAN",
    "text.VLSM_autom_tico_por_necesidad": "VLSM automático por necesidad",
    "text.Auditor_a_capa_1": "Auditoría capa 1",
    "text.Aplicar": "Aplicar",
    "text.Previsualizar": "Previsualizar",
    "text.Ver_diff": "Ver diff",
    "text.Validar": "Validar",
    "text.Ejecutar_puerta": "Ejecutar puerta",
    "text.Proponer_DHCP": "Proponer DHCP",
    "text.Proponer_pools_DHCP": "Proponer pools DHCP",
    "text.Validar_DHCP": "Validar DHCP",
    "text.Asignar_IPs_a_enlaces_L3": "Asignar IPs a enlaces L3",
    "msg.projectComplete": "¡Proyecto completo! Exporta en la sección Config."
  },
  "en": {
    "app.title": "NetWizard Pro",
    "app.version": "NetWizard v3.48 RC",
    "top.project": "Project:",
    "top.saved": "✓ saved",
    "top.new": "🗑 New",
    "top.export": "⬆ Export",
    "top.uiLanguage": "UI language",
    "top.reportLanguage": "Reports",
    "locale.es": "Español",
    "locale.en": "English",
    "sidebar.sec.start": "Start",
    "sidebar.sec.network": "Network",
    "sidebar.sec.visual": "Visualization",
    "sidebar.sec.connectivity": "Connectivity",
    "sidebar.sec.security": "Security",
    "sidebar.sec.export": "Export",
    "sidebar.sec.summary": "Summary",
    "nav.dash": "Dashboard",
    "nav.wiz": "Wizard",
    "nav.loc": "Locations",
    "nav.dev": "Devices",
    "nav.ports": "Ports & Interfaces",
    "nav.vlan": "VLANs & Subnets",
    "nav.hosts": "Hosts & IP Map",
    "nav.iot": "IoT & Gateways",
    "nav.graphs": "Graph views",
    "nav.links": "Ports & Links",
    "nav.fw": "Firewall",
    "nav.cfg": "Configuration",
    "dash.title": "🏠 Project dashboard",
    "dash.projectName": "Project name",
    "dash.projectPlaceholder": "Corporate network…",
    "actions.save": "Save",
    "actions.cancel": "Cancel",
    "actions.close": "Close",
    "actions.download": "Download",
    "docs.card.title": "📑 Inventory, documentation and matrix",
    "docs.card.badge": "v3.48 i18n",
    "docs.card.desc": "Export an operational project inventory and review a VLAN connectivity matrix before production.",
    "docs.viewMatrix": "View matrix",
    "docs.downloadInventory": "Download inventory CSV",
    "docs.downloadMatrix": "Download matrix CSV",
    "docs.downloadMarkdown": "Download Markdown documentation",
    "docs.matrix.empty": "There are not enough VLANs to generate a matrix.",
    "docs.matrix.title": "VLAN connectivity matrix",
    "docs.matrix.more": "... {count} more rows. Download CSV to view everything.",
    "doc.title": "NetWizard documentation — {project}",
    "doc.exported": "Exported: {date}",
    "doc.summary": "Summary",
    "doc.devices": "Devices",
    "doc.vlans": "VLANs",
    "doc.ports": "Ports",
    "doc.links": "Links",
    "doc.hosts": "Hosts",
    "doc.dhcp": "DHCP",
    "doc.firewall": "Firewall",
    "doc.connectivityMatrix": "Connectivity matrix",
    "doc.notes": "Notes",
    "doc.note.design": "This documentation is a design aid and must be reviewed before production.",
    "doc.note.review": "Rows marked as `REVIEW`, `ALLOW/REVIEW` or `DENY/REVIEW` require technical validation.",
    "i18n.loaded": "Language loaded",
    "pg.card.title": "🚦 Production gate",
    "pg.card.badge": "v3.48 i18n",
    "pg.card.desc": "Final aggregated validation before exporting or applying changes. Includes a prioritized remediation guide and exportable checklist.",
    "pg.strict": "Strict production profile",
    "pg.showGuide": "Show remediation guide",
    "pg.run": "Run gate",
    "pg.guide": "Remediation guide",
    "pg.downloadChecklist": "Download checklist",
    "pg.goExport": "Go to export",
    "pg.guide.empty": "✅ There are no issues requiring remediation with the current filters.",
    "pg.guide.title": "Prioritized remediation guide",
    "pg.guide.section": "Recommended section",
    "pg.guide.why": "Why it matters",
    "pg.guide.how": "How to fix",
    "pg.guide.shown": "Showing {count} prioritized issues. Adjust filters or resolve the first items and run the gate again.",
    "pg.severity.error": "ERROR",
    "pg.severity.warning": "WARNING",
    "pg.severity.info": "INFO",
    "pg.status.ready": "READY",
    "pg.status.review": "REQUIRES REVIEW",
    "pg.status.blocked": "BLOCKED",
    "pg.mode.production": "production",
    "pg.mode.demo": "demo",
    "pg.mode.strict": "strict",
    "pg.checklist.title": "NetWizard production checklist",
    "pg.checklist.state": "Status",
    "pg.checklist.mode": "Mode",
    "pg.checklist.generated": "Generated",
    "pg.checklist.errors": "Errors",
    "pg.checklist.warnings": "Warnings",
    "pg.checklist.info": "Info",
    "pg.checklist.byCategory": "Summary by category",
    "pg.checklist.noIssues": "No issues.",
    "pg.checklist.recommendedFixes": "Recommended fixes",
    "pg.checklist.noFixes": "No pending fixes with the current data.",
    "pg.checklist.message": "Message",
    "pg.checklist.section": "Section",
    "pg.checklist.why": "Why it matters",
    "pg.checklist.steps": "Steps",
    "pg.checklist.exitCriteria": "Exit criteria",
    "pg.checklist.exit.noBlocked": "The production gate is not BLOCKED.",
    "pg.checklist.exit.rulesReviewed": "Generated rules have been reviewed.",
    "pg.checklist.exit.vendorReviewed": "Vendor exports have been reviewed in a lab.",
    "pg.checklist.exit.snapshot": "A snapshot/JSON export is kept before deployment.",
    "matrix.destination.internet": "Internet/WAN",
    "matrix.service.internet": "DNS, HTTP, HTTPS according to policy",
    "matrix.service.none": "—",
    "matrix.service.local": "local",
    "matrix.service.review": "as required",
    "matrix.reason.internet.allow": "VLAN intent allows Internet access",
    "matrix.reason.internet.deny": "VLAN intent does not declare Internet access",
    "matrix.reason.local": "Traffic within the same VLAN",
    "matrix.reason.blocked": "Inter-VLAN matrix marked this path as blocked",
    "matrix.reason.explicit": "Explicit firewall rule",
    "matrix.reason.isolation": "Intent {type} recommends lateral isolation",
    "matrix.reason.management": "Management VLAN; confirm administrative scope",
    "matrix.reason.default": "No explicit rule; review before production",
    "doc.generatedBy": "Generated by NetWizard",
    "doc.auditChecklist": "Production checklist",
    "doc.language": "Report language",
    "actions.add": "Add",
    "actions.edit": "Edit",
    "actions.delete": "Delete",
    "actions.apply": "Apply",
    "actions.preview": "Preview",
    "actions.run": "Run",
    "actions.validate": "Validate",
    "actions.generate": "Generate",
    "actions.copy": "Copy",
    "actions.reset": "Reset",
    "actions.import": "Import",
    "actions.finish": "Finish",
    "actions.next": "Next →",
    "actions.previous": "← Previous",
    "common.all": "All",
    "common.none": "none selected",
    "common.noTitle": "Untitled",
    "common.noDevices": "No devices.\nUse the Wizard to start.",
    "common.noVlans": "No VLANs",
    "common.noHosts": "No hosts",
    "dash.stats.devices": "Devices",
    "dash.stats.rules": "FW rules",
    "form.name": "Name",
    "form.type": "Type",
    "form.vendor": "Vendor",
    "form.model": "Model",
    "form.notes": "Notes",
    "form.description": "Description",
    "form.device": "Device",
    "form.port": "Port",
    "form.mode": "Mode",
    "form.info": "VLAN/Info",
    "form.ip": "IP",
    "form.mac": "MAC",
    "form.gateway": "Gateway",
    "form.subnet": "Subnet",
    "form.status": "Status",
    "form.action": "Action",
    "form.services": "Services",
    "form.reason": "Reason",
    "sections.devices": "Devices",
    "sections.ports": "Ports",
    "sections.vlans": "VLANs",
    "sections.subnets": "Subnets",
    "sections.hosts": "Hosts",
    "sections.links": "Links",
    "sections.firewall": "Firewall",
    "sections.dhcp": "DHCP",
    "sections.security": "Security",
    "sections.config": "Configuration",
    "i18n.coverage.title": "Translation coverage",
    "i18n.coverage.desc": "Progressive translation of UI, forms, reports and messages. Internal project keys are not translated.",
    "i18n.audit.noHtml": "Translations are treated as plain text to preserve XSS hardening.",
    "text.Proyecto": "Project:",
    "text.guardado": "✓ saved",
    "text.Nuevo": "🗑 New",
    "text.Exportar": "⬆ Export",
    "text.Panel": "Dashboard",
    "text.Asistente": "Wizard",
    "text.Ubicaciones": "Locations",
    "text.Dispositivos": "Devices",
    "text.Puertos_Interfaces": "Ports & Interfaces",
    "text.VLANs_Subnets": "VLANs & Subnets",
    "text.Hosts_IP_Map": "Hosts & IP Map",
    "text.IoT_Gateways": "IoT & Gateways",
    "text.Vistas_gr_ficas": "Graph views",
    "text.Puertos_Enlaces": "Ports & Links",
    "text.Firewall": "Firewall",
    "text.Configuraci_n": "Configuration",
    "text.Finalizar": "Finish",
    "text.Siguiente": "Next →",
    "text.Anterior": "← Previous",
    "text.Guardar": "Save",
    "text.Cancelar": "Cancel",
    "text.Cerrar": "Close",
    "text.Descargar": "Download",
    "text.Nombre": "Name",
    "text.Tipo": "Type",
    "text.Vendor": "Vendor",
    "text.Modelo": "Model",
    "text.Notas": "Notes",
    "text.Descripci_n": "Description",
    "text.Dispositivo": "Device",
    "text.Puerto": "Port",
    "text.Modo": "Mode",
    "text.VLAN_Info": "VLAN/Info",
    "text.IP": "IP",
    "text.MAC": "MAC",
    "text.Gateway": "Gateway",
    "text.Estado": "Status",
    "text.Acci_n": "Action",
    "text.Servicios": "Services",
    "text.Motivo": "Reason",
    "text.Nombre_del_proyecto": "Project name",
    "text.Red_corporativa": "Corporate network…",
    "text.Sin_t_tulo": "Untitled",
    "text.Sin_dispositivos_Usa_el_Asistente_para_empezar": "No devices.\nUse the Wizard to start.",
    "text.Sin_VLANs": "No VLANs",
    "text.Sin_hosts": "No hosts",
    "text.Sin_subnet": "No subnet",
    "text.Escenario": "Scenario:",
    "text.VLANs": "VLANs:",
    "text.Dispositivos_seleccionados": "Selected devices:",
    "text.ninguno_seleccionado": "(none selected)",
    "text.A_adir": "Add",
    "text.Guardar_cambios": "Save changes",
    "text.A_adir_dispositivo": "Add device",
    "text.A_adir_puerto": "Add port",
    "text.A_adir_VLAN": "Add VLAN",
    "text.A_adir_host": "Add host",
    "text.Crear_enlace": "Create link",
    "text.Editar": "Edit",
    "text.Eliminar": "Delete",
    "text.Todos": "All",
    "text.Cambia_el_filtro": "Change the filter.",
    "text.A_ade_puertos_arriba": "Add ports above.",
    "text.a_ade_un_dispositivo_primero": "— add a device first —",
    "text.access_usuario_host": "access (user/host)",
    "text.trunk_uplink_RoaS": "trunk (uplink/RoaS)",
    "text.LAN_trunk_a_switches": "LAN (trunk to switches)",
    "text.WAN_hacia_ISP": "WAN (to ISP)",
    "text.routed_L3_directo": "routed (direct L3)",
    "text.Puerta_de_producci_n": "Production gate",
    "text.Gu_a_de_correcci_n": "Remediation guide",
    "text.Descargar_checklist": "Download checklist",
    "text.Ir_a_exportaci_n": "Go to export",
    "text.Perfil_estricto_de_producci_n": "Strict production profile",
    "text.Inventario_documentaci_n_y_matriz": "Inventory, documentation and matrix",
    "text.Ver_matriz": "View matrix",
    "text.Descargar_inventario_CSV": "Download inventory CSV",
    "text.Descargar_matriz_CSV": "Download matrix CSV",
    "text.Descargar_documentaci_n_Markdown": "Download Markdown documentation",
    "text.Preparaci_n_para_producci_n": "Production readiness",
    "text.Modo_de_ejecuci_n": "Execution mode",
    "text.Plan_com_n_de_cambios": "Common change plan",
    "text.Historial_y_snapshots": "History and snapshots",
    "text.Auditor_a_L2_avanzada": "Advanced L2 audit",
    "text.Riesgo_broadcast": "Broadcast risk",
    "text.Hardening_exportaci_n_vendor": "Vendor export hardening",
    "text.Intenci_n_por_VLAN": "VLAN intent",
    "text.VLSM_autom_tico_por_necesidad": "Automatic VLSM by requirement",
    "text.Auditor_a_capa_1": "Layer 1 audit",
    "text.Aplicar": "Apply",
    "text.Previsualizar": "Preview",
    "text.Ver_diff": "View diff",
    "text.Validar": "Validate",
    "text.Ejecutar_puerta": "Run gate",
    "text.Proponer_DHCP": "Suggest DHCP",
    "text.Proponer_pools_DHCP": "Suggest DHCP pools",
    "text.Validar_DHCP": "Validate DHCP",
    "text.Asignar_IPs_a_enlaces_L3": "Assign IPs to L3 links",
    "msg.projectComplete": "Project complete! Export in the Configuration section."
  }
};
  const SUPPORTED=localeMeta.map(x=>String(x.code||'').trim()).filter(Boolean);

  const exactText={};
  function rebuildExactText(){
    Object.keys(exactText).forEach(k=>delete exactText[k]);
    const source=dictionaries[FALLBACK]||{};
    for(const loc of SUPPORTED){
      if(loc===FALLBACK) continue;
      const target=dictionaries[loc]||{};
      const map={};
      Object.keys(source).forEach(k=>{ if(k.startsWith('text.') && Object.prototype.hasOwnProperty.call(target,k)) map[source[k]]=target[k]; });
      exactText[loc]=map;
    }
  }
  rebuildExactText();

  function primaryOf(locale){ return String(locale||'').toLowerCase().split('-')[0]; }
  function normalizeLocale(locale){
    const raw=String(locale||'').trim();
    if(!raw) return FALLBACK;
    const lower=raw.toLowerCase();
    const exact=SUPPORTED.find(x=>x.toLowerCase()===lower);
    if(exact) return exact;
    const p=primaryOf(lower);
    const byPrimary=SUPPORTED.find(x=>primaryOf(x)===p);
    return byPrimary || FALLBACK;
  }
  function storageGet(k){ try{return root.localStorage&&root.localStorage.getItem(k);}catch(e){return '';} }
  function storageSet(k,v){ try{root.localStorage&&root.localStorage.setItem(k,v);}catch(e){} }
  function getLocale(){ return normalizeLocale(storageGet(LOCALE_KEY) || (root.document&&root.navigator&&root.navigator.language) || FALLBACK); }
  function setLocale(locale){ const next=normalizeLocale(locale); storageSet(LOCALE_KEY,next); applyI18n(root.document); dispatchChange(); return next; }
  function getReportLocale(){ return normalizeLocale(storageGet(REPORT_LOCALE_KEY) || getLocale()); }
  function setReportLocale(locale){ const next=normalizeLocale(locale); storageSet(REPORT_LOCALE_KEY,next); dispatchChange(); return next; }
  function interpolate(value, params){
    return String(value).replace(/\{([A-Za-z0-9_.-]+)\}/g, (_,key)=>Object.prototype.hasOwnProperty.call(params||{},key)?String(params[key]):'');
  }
  function t(key, params, locale){
    const loc=normalizeLocale(locale||getLocale());
    const dict=dictionaries[loc]||{};
    const fallback=dictionaries[FALLBACK]||{};
    const value=Object.prototype.hasOwnProperty.call(dict,key)?dict[key]:(Object.prototype.hasOwnProperty.call(fallback,key)?fallback[key]:key);
    return interpolate(value, params||{});
  }
  function supportedLocales(){ return SUPPORTED.slice(); }
  function getLocaleMeta(locale){ const loc=normalizeLocale(locale); return localeMeta.find(x=>x.code===loc) || {code:loc,label:loc,nativeName:loc,rtl:false}; }
  function isPlainTextDictionary(locale){
    const dict=dictionaries[normalizeLocale(locale)]||{};
    return Object.keys(dict).every(k=>!/[<>]|on\w+=|javascript:/i.test(String(dict[k])));
  }
  function registerLocale(locale, dictionary, meta){
    const code=String(locale||'').trim();
    if(!code) throw new Error('registerLocale requiere código de idioma.');
    dictionaries[code]=Object.assign({}, dictionary||{});
    if(!SUPPORTED.includes(code)) SUPPORTED.push(code);
    const existing=localeMeta.find(x=>x.code===code);
    if(existing) Object.assign(existing, meta||{});
    else localeMeta.push(Object.assign({code,label:code,nativeName:code,rtl:false}, meta||{}));
    rebuildExactText();
    applyI18n(root.document);
    return code;
  }
  async function loadExternalLocale(locale){
    if(!root.fetch) throw new Error('fetch no disponible para cargar idiomas externos.');
    const code=String(locale||'').trim();
    const res=await root.fetch('./i18n/'+encodeURIComponent(code)+'.json', {cache:'no-cache'});
    if(!res.ok) throw new Error('No se pudo cargar idioma '+code+' ('+res.status+')');
    const dict=await res.json();
    registerLocale(code, dict, {code});
    return code;
  }
  function applyI18n(doc){
    doc=doc||root.document; if(!doc) return;
    const loc=getLocale();
    const html=doc.documentElement; if(html){ html.lang=loc; const meta=getLocaleMeta(loc); html.dir=meta.rtl?'rtl':'ltr'; }
    ensureSelector(doc);
    doc.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.getAttribute('data-i18n')); });
    doc.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    doc.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    translateSidebar(doc);
    translateExactVisibleText(doc);
    syncSelectors(doc);
  }
  function translateExactVisibleText(doc){
    const loc=getLocale();
    if(loc===FALLBACK) return;
    const map=exactText[loc]||{};
    const allowed='button,th,label,option,.card-t,.sl,.empty p,.hint,.b,.tab,.bnit,.chip,.co,.muted';
    doc.querySelectorAll(allowed).forEach(el=>{
      if(el.children && el.children.length) return;
      const txt=(el.textContent||'').trim();
      if(!txt) return;
      if(Object.prototype.hasOwnProperty.call(map,txt)) el.textContent=map[txt];
    });
  }
  function translateSidebar(doc){
    const sections=['start','network','visual','connectivity','security','export','summary'];
    doc.querySelectorAll('.sb-sec').forEach((el,idx)=>{ const key=el.getAttribute('data-i18n')||('sidebar.sec.'+(sections[idx]||idx)); el.setAttribute('data-i18n',key); el.textContent=t(key); });
    const stepMap={dash:'nav.dash',wiz:'nav.wiz',loc:'nav.loc',dev:'nav.dev',ports:'nav.ports',vlan:'nav.vlan',hosts:'nav.hosts',iot:'nav.iot',graphs:'nav.graphs',links:'nav.links',fw:'nav.fw',cfg:'nav.cfg'};
    doc.querySelectorAll('.sb-it[data-step]').forEach(el=>{
      const step=el.getAttribute('data-step'); const key=stepMap[step]; if(!key) return;
      let label=el.querySelector('.sb-label');
      if(!label){ label=doc.createElement('span'); label.className='sb-label';
        const iconText=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('').trim().split(/\s+/)[0]||'';
        Array.from(el.childNodes).forEach(n=>{ if(n.nodeType===3) n.remove(); });
        if(iconText){ const icon=doc.createTextNode(iconText+' '); el.appendChild(icon); }
        el.appendChild(label);
      }
      label.textContent=t(key);
    });
  }
  function ensureSelector(doc){
    if(!doc||doc.getElementById('nwLangBox')) return;
    const top=doc.querySelector('header.top'); if(!top) return;
    const box=doc.createElement('div'); box.id='nwLangBox'; box.className='nw-lang-box';
    const uiLabel=doc.createElement('label'); uiLabel.className='nw-lang-label'; uiLabel.textContent=t('top.uiLanguage');
    const uiSel=doc.createElement('select'); uiSel.id='nwLocaleSel'; uiSel.className='nw-lang-select';
    const repLabel=doc.createElement('label'); repLabel.className='nw-lang-label'; repLabel.textContent=t('top.reportLanguage');
    const repSel=doc.createElement('select'); repSel.id='nwReportLocaleSel'; repSel.className='nw-lang-select';
    uiSel.addEventListener('change',()=>setLocale(uiSel.value));
    repSel.addEventListener('change',()=>setReportLocale(repSel.value));
    box.appendChild(uiLabel); box.appendChild(uiSel); box.appendChild(repLabel); box.appendChild(repSel);
    const actions=top.querySelector('div[style*="display:flex"]'); top.insertBefore(box, actions||null);
  }
  function fillLocaleSelect(sel, selected){
    if(!sel) return;
    const current=sel.value;
    while(sel.firstChild) sel.removeChild(sel.firstChild);
    for(const meta of localeMeta){
      const code=meta.code; if(!code || !dictionaries[code]) continue;
      const opt=(sel.ownerDocument||root.document).createElement('option');
      opt.value=code; opt.textContent=meta.nativeName || meta.label || t('locale.'+code,{},code) || code;
      sel.appendChild(opt);
    }
    sel.value=selected || current || FALLBACK;
  }
  function syncSelectors(doc){
    doc=doc||root.document; if(!doc) return;
    const ui=doc.getElementById('nwLocaleSel'), rep=doc.getElementById('nwReportLocaleSel');
    fillLocaleSelect(ui, getLocale()); fillLocaleSelect(rep, getReportLocale());
    const uiLabel=doc.querySelector('#nwLangBox label:nth-of-type(1)'); if(uiLabel) uiLabel.textContent=t('top.uiLanguage');
    const repLabel=doc.querySelector('#nwLangBox label:nth-of-type(2)'); if(repLabel) repLabel.textContent=t('top.reportLanguage');
  }
  function init(){ ensureSelector(root.document); applyI18n(root.document); }
  function dispatchChange(){ try{ root.dispatchEvent&&root.dispatchEvent(new CustomEvent('netwizard:i18n',{detail:{locale:getLocale(),reportLocale:getReportLocale()}})); }catch(e){} }
  if(root.document){ if(root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded', init); else setTimeout(init,0); }
  const api={version:'netwizard-i18n-v3.48',t,getLocale,setLocale,getReportLocale,setReportLocale,applyI18n,supportedLocales,getLocaleMeta,isPlainTextDictionary,registerLocale,loadExternalLocale,dictionaries,localeMeta,exactText};
  root.NetWizardI18n=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window !== 'undefined' ? window : globalThis);
