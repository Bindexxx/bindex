-- ROLLBACK di 128: rimette i valori di prima sulle stesse righe (id presi il 09/11/2026).

update carte set lingua = 'JA' where id in (
  '198609de-5dc0-4de5-be25-eb9ddc1c92b7','207a86c7-4494-4812-b08a-a2185fd633af','4517e6bb-999d-4bbf-a945-b09bc679d2ac',
  '49201338-2a7e-4469-b89a-884f066d22cc','58eca391-fcaf-47fa-a149-ac23fadf06aa','6a879dee-805e-4903-baf5-094179ab9cad',
  '79d503dd-fa81-4fa3-86c4-33b5adb900e9','7a1a168c-964a-4a1a-ba0c-f9f5229ffa23','95b853a4-9595-48bc-bc60-269bacc5c6d0',
  'e2dc47ce-f7c0-46be-9fdb-a43aa0e8e0e4','f16503c4-bf72-484a-8cfc-501e58eb7b7b');

update carte set lingua = 'JAP' where id in (
  '02753da5-3c2b-4c57-b969-aae1647f59ab','d7521568-718d-4dd4-8933-5f2daa9d8ba7','2455c1ef-d746-4a6d-8d64-667d166ddda4',
  '2f88f716-0ef8-46cf-89ef-ac262573ee13','6a97ad89-ee21-4f00-9bd3-0d5e8343b3a8');

update carte set lingua = 'ENG' where id in (
  '35f0b4c9-b483-43b3-a305-bd9d143582c5','87da019d-5c77-4b81-adb1-e6aa87ec2442','2a2e8e71-75a2-4114-a7ef-4f05552bb7e7',
  '43b079e5-2688-4d55-8471-160a1812c064','8e752338-a328-40f2-820e-86d18b518597','c0329d3d-976c-451b-bc04-9424c91ee861',
  'deb163bb-e6bd-416d-b2e2-2d8b1b43ec84','fa8b969c-6cec-41f6-ad4a-34d617c97e85','fba42c48-2f7b-4201-9b20-d69490c8e59a');

update carte set condizione = 'nm' where id = '65993894-8f64-42e6-85fd-2a6d7d04c5ef';
