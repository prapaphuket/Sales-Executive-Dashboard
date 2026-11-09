/* ตั้งค่าการเข้าสู่ระบบ Microsoft 365 ของเว็บ static (ไม่มีความลับในไฟล์นี้ — client/tenant/group ID เปิดเผยได้) */
window.HEA_AUTH = {
  clientId: '75b5084b-4823-4a13-bb79-d47af910fb21',     // App registration (SPA) เดิมของ WMS dashboard — ต้องเพิ่ม Redirect URI ของเว็บนี้
  tenantId: '54cf0b45-7b5b-41b0-bbeb-dddef5eae512',
  groupId: '1512fedb-c62b-43b4-889c-3be09db226dc',      // กลุ่มที่ดูได้ (ตอนนี้ใช้ wms_dashboard_viewers) — เปลี่ยนได้
  groupName: 'wms_dashboard_viewers',
  // ลิงก์แชร์ไฟล์กุญแจใน SharePoint/OneDrive (แชร์ให้เฉพาะกลุ่มที่ดูได้) — ใส่หลังอัปโหลดไฟล์กุญแจ
  keyShareUrl: '__ใส่ลิงก์แชร์ไฟล์กุญแจ__',
  // redirectUri: 'https://<owner>.github.io/<repo>/',   // ไม่ใส่ = ใช้ URL ของหน้าเว็บเอง
};
