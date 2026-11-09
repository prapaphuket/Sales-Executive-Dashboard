/* เลือกธีม: อัตโนมัติ (ตามเครื่อง) / สว่าง / มืด — โหลดใน <head> เพื่อไม่ให้หน้าจอกะพริบ */
(function () {
  var KEY = 'hea-dash-theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function pref() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function apply(p) {
    var dark = p === 'dark' || (p === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-pref', p);
  }
  apply(pref());
  window.HEATheme = {
    get: pref,
    set: function (p) { try { localStorage.setItem(KEY, p); } catch (e) {} apply(p); document.dispatchEvent(new Event('hea-theme')); },
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (pref() === 'auto') { apply('auto'); document.dispatchEvent(new Event('hea-theme')); } });
})();
