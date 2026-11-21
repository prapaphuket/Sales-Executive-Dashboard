/* เลือกธีม: ปกติ (ธีมองค์กร HEA) / มืด / สว่าง — จำค่าที่เลือก · โหลดใน <head> เพื่อไม่ให้หน้าจอกะพริบ */
(function () {
  var KEY = 'hea-theme', OLD = 'hea-dash-theme', OK = ['hea', 'dark', 'light'];
  function pref() {
    var v = null;
    try {
      v = localStorage.getItem(KEY);
      // ย้ายค่าจากปุ่มชุดเดิม (อัตโนมัติ/สว่าง/มืด): มืด = มืด · ที่เหลือ = ปกติ (หน้าตาเดิมที่ผู้ใช้เห็น)
      if (!v) { var o = localStorage.getItem(OLD); if (o) { v = o === 'dark' ? 'dark' : 'hea'; localStorage.setItem(KEY, v); localStorage.removeItem(OLD); } }
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    return OK.indexOf(v) < 0 ? 'hea' : v;
  }
  function apply(p) { document.documentElement.setAttribute('data-theme', p); }
  apply(pref());
  window.HEATheme = {
    get: pref,
    set: function (p) { if (OK.indexOf(p) < 0) p = 'hea'; try { localStorage.setItem(KEY, p); } catch (e) { /* ใช้ค่าในหน้านี้อย่างเดียว */ } apply(p); document.dispatchEvent(new Event('hea-theme')); },
  };
})();
