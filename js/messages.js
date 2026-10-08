// UI boundary: preserve useful business messages, never show provider internals.
(function () {
  function message(value) {
    const text = String(value?.message || value || 'No se pudo completar la operación.');
    if (/firebase|fiberbase|firebasestorage|identitytoolkit|securetoken|auth\/[a-z-]+/i.test(text))
      return 'No se pudo completar la operación. Inténtalo nuevamente. Si continúa, contacta al restaurante.';
    return text;
  }
  window.ChingadazoMessages = { message };
  const originalAlert = window.alert.bind(window);
  window.alert = value => originalAlert(message(value));
})();
