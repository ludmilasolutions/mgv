/* ======= Promo mail link (Sebastián Mascali) ======= */
(function promoInit(){
  var subj = encodeURIComponent('Quiero una web para mi negocio');
  var body = encodeURIComponent(
    'Hola Sebastián,\n' +
    'Vi tu trabajo y quiero pedir un presupuesto para mi web.\n\n' +
    'Tipo de sitio: (catálogo / pedidos / restaurante / otro)\n' +
    '¿Panel para editar productos?: (sí/no)\n' +
    '¿Plazo ideal?: (fecha)\n\n' +
    '¡Gracias!'
  );
  var mailEl = document.getElementById('promoMail');
  if(mailEl){
    mailEl.href = 'mailto:angelmascali@gmail.com?subject=' + subj + '&body=' + body;
    // Si usas analytics, podrías loguear el click acá
    try{ mailEl.addEventListener('click', function(){ if(window.logEvent) logEvent('promo_mail_click'); }); }catch(_){}
  }
})();