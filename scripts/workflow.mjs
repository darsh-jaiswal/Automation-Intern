import { writeFile, mkdir } from 'node:fs/promises';
import { config, root } from '../src/config.mjs';

const credentials = { httpHeaderAuth: { id: 'automation-worker-header', name: 'Automation Worker' } };
const workerPort = config().port;
const http = (name, route, x, y, body) => ({
  id: name.toLowerCase().replaceAll(' ', '-'), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x,y], credentials,
  parameters: { method: body ? 'POST' : 'GET', url: `http://127.0.0.1:${workerPort}${route}`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', ...(body ? { sendBody: true, specifyBody: 'json', jsonBody: body } : {}), options: { timeout: 300000 } },
});
const nodes = [
  { id: 'manual', name: 'Run sample CSV', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0,0], parameters: {} },
  http('Import every original session', '/api/import', 230,0,'={}'),
  http('List unique contacts', '/api/contacts',460,0),
  { id: 'split', name: 'One item per person', type: 'n8n-nodes-base.code', typeVersion: 2, position: [690,0], parameters: { jsCode: 'return $json.contacts.map(contact => ({ json: { contact_id: contact.id } }));' } },
  { id: 'loop', name: 'Process people in order', type: 'n8n-nodes-base.splitInBatches', typeVersion: 3, position: [920,0], parameters: { batchSize: 1, options: {} } },
  http('Clean and score', '/api/assess',1150,100,'={{ JSON.stringify({contact_id: $json.contact_id}) }}'),
  http('Write and validate draft', '/api/draft',1380,100,'={{ JSON.stringify({assessment_id: $json.id}) }}'),
  http('Save CRM draft and Hot alert', '/api/publish',1610,100,'={{ JSON.stringify({assessment_id: $json.id}) }}'),
  http('Review final results', '/api/state',1150,-160),
  { id: 'webhook', name: 'New tool session webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [230,400], webhookId: 'automation-intern-session', credentials, parameters: { httpMethod: 'POST', path: 'automation-intern-session', authentication: 'headerAuth', responseMode: 'onReceived', options: {} } },
  http('Preserve new tool session', '/api/sessions',460,400,'={{ JSON.stringify($json.body) }}'),
  { id: 'contact', name: 'Use incoming contact', type: 'n8n-nodes-base.code', typeVersion: 2, position: [690,400], parameters: { jsCode: 'return [{json:{contact_id:$json.contact_id}}];' } },
  { id:'note', name:'Rules and AI responsibilities', type:'n8n-nodes-base.stickyNote', typeVersion:1, position:[0,-270], parameters:{width:900,height:180,content:'## Myntmore / Task 1\n**Rules:** preserve sessions, group repeat visitors, exclusions, final score/tier, draft checks, retries and deduplication.\n**Anthropic (or optional Gemini):** interpret business need, choose a service, and write context-based drafts.\n**Safety:** no send endpoints; Zoho workflows and Cadences are suppressed. Import the local Automation Worker credential before running.'} },
];
const edge = (node,index=0) => ({node,type:'main',index});
const connections = {
  'Run sample CSV':{main:[[edge('Import every original session')]]},
  'Import every original session':{main:[[edge('List unique contacts')]]},
  'List unique contacts':{main:[[edge('One item per person')]]},
  'One item per person':{main:[[edge('Process people in order')]]},
  'Process people in order':{main:[[edge('Review final results')],[edge('Clean and score')]]},
  'Clean and score':{main:[[edge('Write and validate draft')]]},
  'Write and validate draft':{main:[[edge('Save CRM draft and Hot alert')]]},
  'Save CRM draft and Hot alert':{main:[[edge('Process people in order')]]},
  'New tool session webhook':{main:[[edge('Preserve new tool session')]]},
  'Preserve new tool session':{main:[[edge('Use incoming contact')]]},
  'Use incoming contact':{main:[[edge('Process people in order')]]},
};
await writeFile(`${root}workflows/task-one.json`, JSON.stringify({ id:'automationInternTaskOne', name:'Automation Intern - Lead Follow-Up Engine', nodes, connections, active:false, settings:{executionOrder:'v1',saveDataErrorExecution:'all',saveDataSuccessExecution:'all'}, pinData:{}, tags:[] },null,2));
if(process.argv.includes('--local-credential')){
  const c=config(); if(c.workerToken.length<24) throw Error('Set WORKER_TOKEN first.');
  await mkdir(`${root}.local`,{recursive:true});
  await writeFile(`${root}.local/n8n-credential.json`,JSON.stringify([{id:'automation-worker-header',name:'Automation Worker',type:'httpHeaderAuth',data:{name:'Authorization',value:`Bearer ${c.workerToken}`}}]),{mode:0o600});
  console.log('Workflow and gitignored local credential file generated. No secrets printed.');
} else console.log('Sanitised n8n workflow generated.');
