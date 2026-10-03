/* NetWizard Wizard Production Presets v1 */
(function initNetWizardWizardPresets(root){
'use strict';
const presets={
  'production-small-office': {
  "_schemaVersion": "3.50.0",
  "step": "dash",
  "selected": null,
  "vlanMatrix": {},
  "security": {},
  "roas": {},
  "vtp": {
    "roles": {}
  },
  "topo": {
    "pos": {}
  },
  "visual": {
    "locs": [],
    "assign": {
      "devices": {},
      "hosts": {}
    },
    "pos": {},
    "view": {}
  },
  "physicalLocations": [],
  "hostPhysicalLocations": [],
  "uiSort": {},
  "iot": {
    "accessNodes": [],
    "devices": [],
    "map": {
      "show": {}
    }
  },
  "projName": "Sample · Small Office",
  "devices": [
    {
      "id": "fw1",
      "name": "FW1",
      "type": "firewall",
      "kind": "firewall",
      "vendorOs": "fortinet"
    },
    {
      "id": "sw1",
      "name": "SW-Access",
      "type": "switch",
      "kind": "switch",
      "vendorOs": "cisco_ios",
      "poeBudgetW": 120
    },
    {
      "id": "ap1",
      "name": "AP-Guest",
      "type": "access_point",
      "kind": "access_point",
      "vendorOs": "ubiquiti_unifi"
    }
  ],
  "vlans": [
    {
      "id": "v10",
      "vlanId": 10,
      "name": "Users",
      "intent": {
        "type": "users",
        "expectedHosts": 20,
        "growthHosts": 5,
        "dhcp": true,
        "internet": true,
        "isolation": "standard",
        "criticality": "medium"
      }
    },
    {
      "id": "v20",
      "vlanId": 20,
      "name": "Guests",
      "intent": {
        "type": "guests",
        "expectedHosts": 30,
        "growthHosts": 10,
        "dhcp": true,
        "internet": true,
        "isolation": "isolated",
        "criticality": "low"
      }
    },
    {
      "id": "v99",
      "vlanId": 99,
      "name": "Management-Native",
      "intent": {
        "type": "management",
        "expectedHosts": 5,
        "growthHosts": 2,
        "dhcp": false,
        "internet": false,
        "isolation": "restricted",
        "criticality": "high"
      }
    }
  ],
  "subnets": [
    {
      "id": "s10",
      "vlanRef": "v10",
      "cidr": "10.10.10.0/24",
      "gateway": "10.10.10.1"
    },
    {
      "id": "s20",
      "vlanRef": "v20",
      "cidr": "10.10.20.0/24",
      "gateway": "10.10.20.1"
    },
    {
      "id": "s99",
      "vlanRef": "v99",
      "cidr": "10.10.99.0/24",
      "gateway": "10.10.99.1"
    }
  ],
  "ports": [
    {
      "id": "fw_lan",
      "deviceId": "fw1",
      "name": "port1",
      "mode": "trunk",
      "allowedVlans": [
        10,
        20,
        99
      ],
      "nativeVlanRef": "v99",
      "uplink": true,
      "portFast": false,
      "bpduGuard": false
    },
    {
      "id": "sw_uplink",
      "deviceId": "sw1",
      "name": "Gi0/24",
      "mode": "trunk",
      "allowedVlans": [
        10,
        20,
        99
      ],
      "nativeVlanRef": "v99",
      "uplink": true,
      "portFast": false,
      "bpduGuard": false
    },
    {
      "id": "sw_p1",
      "deviceId": "sw1",
      "name": "Gi0/1",
      "mode": "access",
      "accessVlanRef": "v10",
      "portFast": true,
      "bpduGuard": true,
      "poeMode": "auto",
      "poeWattsMax": 30
    },
    {
      "id": "sw_p2",
      "deviceId": "sw1",
      "name": "Gi0/2",
      "mode": "trunk",
      "allowedVlans": [
        20,
        99
      ],
      "nativeVlanRef": "v99",
      "uplink": true,
      "poeMode": "at",
      "poeWattsMax": 30
    },
    {
      "id": "ap_uplink",
      "deviceId": "ap1",
      "name": "eth0",
      "mode": "trunk",
      "allowedVlans": [
        20,
        99
      ],
      "nativeVlanRef": "v99",
      "uplink": true
    }
  ],
  "links": [
    {
      "id": "l1",
      "aPortId": "fw_lan",
      "bPortId": "sw_uplink",
      "medium": "copper",
      "cableType": "cat6",
      "lengthM": 15,
      "speed": "1G"
    },
    {
      "id": "l2",
      "aPortId": "sw_p2",
      "bPortId": "ap_uplink",
      "medium": "copper",
      "cableType": "cat6",
      "lengthM": 18,
      "speed": "1G"
    }
  ],
  "hosts": [
    {
      "id": "pc1",
      "name": "PC-Admin",
      "type": "pc",
      "vlanRef": "v10",
      "portRef": "sw_p1",
      "ipMode": "dhcp",
      "staticIp": "",
      "poeRequired": false,
      "poeWatts": null
    },
    {
      "id": "guest_ap",
      "name": "AP-Guest",
      "type": "ap",
      "vlanRef": "v99",
      "portRef": "sw_p2",
      "deviceRef": "ap1",
      "ipMode": "static",
      "staticIp": "10.10.99.10",
      "poeRequired": true,
      "poeWatts": 12
    }
  ],
  "dhcp": {
    "10": {
      "enabled": true,
      "start": "10.10.10.50",
      "end": "10.10.10.200",
      "dns": "1.1.1.1,8.8.8.8",
      "domain": "office.local",
      "lease": 1,
      "exclusions": [
        {
          "start": "10.10.10.1",
          "end": "10.10.10.10",
          "reason": "infra"
        }
      ],
      "reservations": []
    },
    "20": {
      "enabled": true,
      "start": "10.10.20.50",
      "end": "10.10.20.220",
      "dns": "1.1.1.1",
      "domain": "guest.local",
      "lease": 1,
      "exclusions": [
        {
          "start": "10.10.20.1",
          "end": "10.10.20.10",
          "reason": "infra"
        }
      ],
      "reservations": []
    }
  },
  "fwRules": [
    {
      "id": "fw_guest_deny",
      "name": "Guests deny LAN",
      "src": "VLAN20",
      "dst": "RFC1918",
      "proto": "any",
      "port": "any",
      "action": "deny"
    },
    {
      "id": "fw_guest_web",
      "name": "Guests Internet Web",
      "src": "VLAN20",
      "dst": "Internet",
      "proto": "tcp",
      "port": "80,443",
      "action": "allow"
    }
  ]
}
};
const files={
  'golden-office-modern':'./samples/golden-path-office-modern.json',
  'golden-home-lab-modern':'./samples/golden-path-home-lab-modern.json',
  'golden-retail-modern':'./samples/golden-path-retail-modern.json',
  'golden-corp-modern':'./samples/golden-path-corp-modern.json'
};
function clone(value){return JSON.parse(JSON.stringify(value));}
function get(id){return presets[id]?clone(presets[id]):null;}
async function load(id){
  if(presets[id])return clone(presets[id]);
  const url=files[id];if(!url||typeof root.fetch!=='function')return null;
  const response=await root.fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo cargar el ejemplo '+id+' ('+response.status+').');
  const payload=await response.json();
  return clone(payload&&payload.project?payload.project:payload);
}
function list(){return [...Object.keys(presets),...Object.keys(files)];}
const api={version:'netwizard-wizard-presets-v2',get,load,list,files:clone(files)};
root.NetWizardWizardPresets=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
