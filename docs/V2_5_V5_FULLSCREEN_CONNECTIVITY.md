# NetWizard v2.5 · V5 fullscreen + colores + verificador

## Cambios

- Los botones de edición de nodos IoT en V5 funcionan también en pantalla completa.
- Los modales IoT se mueven dentro del contenedor `#v5Layout` cuando la V5 está en fullscreen para que sean descendientes del elemento fullscreen.
- El enlace físico/trunk entre switches deja de usar el mismo color que LoRaWAN.
  - Trunk/Ethernet físico: azul/cian.
  - LoRaWAN: naranja.
- Añadido primer verificador de conectividad lógico.

## Verificador de conectividad

El verificador simula un ping lógico entre dos endpoints. Valida:

- VLAN asignada.
- IP/subnet cuando está disponible.
- Puerto access y VLAN del puerto para hosts cableados.
- Gateways/subnets para inter-VLAN.
- Matriz inter-VLAN.
- Reglas ICMP/firewall simples.

No envía tráfico real. Es una simulación de diseño para detectar incoherencias antes de exportar configuración.

## Próximos pasos

- Añadir vista de camino completo: host → puerto → switch → gateway → VLAN destino.
- Añadir pruebas por protocolo: ICMP, DNS, HTTPS, MQTT, RTSP.
- Incluir IoT inalámbrico con reglas específicas por tecnología.
