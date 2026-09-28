'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const ProjectSchema=require('../js/netwizard-project-schema.js');
const externalSchema=JSON.parse(fs.readFileSync(path.join(root,'schemas','netwizard-project.schema.json'),'utf8'));
const goModel=fs.readFileSync(path.join(root,'backend','internal','projects','model.go'),'utf8');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const appVersion=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();

function regexFromJsonSchemaPattern(pattern){
  assert.strictEqual(typeof pattern,'string','El JSON Schema debe declarar un pattern de versión');
  return new RegExp(pattern);
}

const goVersionMatch=goModel.match(/const\s+SupportedSchemaVersion\s*=\s*"([^"]+)"/);
assert.ok(goVersionMatch,'Go debe declarar projects.SupportedSchemaVersion');

const currentSchemaVersion=ProjectSchema.schemaVersion;
const goSchemaVersion=goVersionMatch[1];
assert.strictEqual(
  goSchemaVersion,
  currentSchemaVersion,
  'JS y Go deben coincidir en la versión canónica actual del formato de proyecto'
);

const rootVersionRule=externalSchema.properties?.schemaVersion;
const projectVersionRule=externalSchema.$defs?.project?.properties?._schemaVersion;
assert.ok(
  regexFromJsonSchemaPattern(rootVersionRule?.pattern).test(currentSchemaVersion),
  `El JSON Schema externo debe aceptar schemaVersion canónico ${currentSchemaVersion}`
);
assert.ok(
  regexFromJsonSchemaPattern(projectVersionRule?.pattern).test(currentSchemaVersion),
  `El JSON Schema externo debe aceptar _schemaVersion canónico ${currentSchemaVersion}`
);

const workflowModes=externalSchema.$defs?.project?.properties?.workflow?.properties?.mode?.enum;
const designDispositions=externalSchema.$defs?.device?.properties?.designDisposition?.enum;
assert.deepStrictEqual(
  workflowModes,
  ProjectSchema.model.workflowModes,
  'workflow.mode debe coincidir entre implementación JS y JSON Schema'
);
assert.deepStrictEqual(
  designDispositions,
  ProjectSchema.model.designDispositions,
  'designDisposition debe coincidir entre implementación JS y JSON Schema'
);

assert.strictEqual(
  packageJson.version,
  appVersion,
  'VERSION y package.json deben coincidir para la versión de aplicación'
);

// Intencionadamente no se compara appVersion con currentSchemaVersion:
// son contratos independientes aunque hoy puedan compartir el mismo número.
assert.ok(currentSchemaVersion,'El contrato de schema debe existir independientemente de la versión de aplicación');

console.log(
  `✓ Contratos cruzados coherentes: app ${appVersion}, schema ${currentSchemaVersion}, `+
  `${workflowModes.length} workflow modes, ${designDispositions.length} dispositions`
);
