/* Fresh GPS samples only. Accuracy is an estimated radius, not a guarantee. */
(function () {
  function sample(p, now=Date.now()) {
    const c=p?.coords, at=Number(p?.timestamp);
    if(!c || !Number.isFinite(c.latitude) || Math.abs(c.latitude)>90 || !Number.isFinite(c.longitude) || Math.abs(c.longitude)>180 || !Number.isFinite(c.accuracy) || c.accuracy<=0 || !Number.isFinite(at) || now-at>15000 || at-now>5000) return null;
    return {lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,capturedAt:at};
  }
  function locate({timeout=25000,targetAccuracy=20,maxAccuracy=100}={}) {
    return new Promise((resolve,reject)=>{
      const geo=navigator.geolocation;
      if(!geo) return reject(new Error('Este dispositivo no ofrece ubicación.'));
      let best=null,done=false,watch=null;
      const finish=()=>{
        if(done)return; done=true; clearTimeout(timer);
        if(watch!==null)geo.clearWatch(watch);
        if(best && Date.now()-best.capturedAt<=15000 && best.accuracy<=maxAccuracy)resolve(best);
        else reject(new Error('No se obtuvo una ubicación suficientemente precisa. Activa Ubicación precisa y acércate a una ventana o sal al exterior para reintentar.'));
      };
      const timer=setTimeout(finish,timeout);
      watch=geo.watchPosition(p=>{
        const next=sample(p); if(!next)return;
        if(!best || Date.now()-best.capturedAt>15000 || next.accuracy<best.accuracy)best=next;
        if(next.accuracy<=targetAccuracy)finish();
      },e=>{if(e.code===1)finish();},{enableHighAccuracy:true,maximumAge:0,timeout});
      if(done && watch!==null)geo.clearWatch(watch);
    });
  }
  window.ChingadazoGPS={sample,locate};
})();
