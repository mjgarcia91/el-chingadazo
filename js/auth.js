(function () {
  const firebaseConfig = globalThis.CHINGADAZO_CONFIG?.firebase || {};
  if (!globalThis.CHINGADAZO_CONFIG?.configured) {
    const unavailable = async () => { throw new Error('El Chingadazo está en preparación. El acceso estará disponible próximamente.'); };
    window.AuthBridge = {
      ready: Promise.resolve(null), current: async () => null, idToken: async () => '',
      signOut: async () => {}, message: error => error.message,
      createEmail: unavailable, signInEmail: unavailable, signInGoogle: unavailable,
      signInToken: unavailable, resendVerification: unavailable,
      resetPassword: unavailable, messagingToken: unavailable, deleteCurrent: unavailable
    };
    return;
  }

  // Firebase se sirve desde el mismo dominio para que el acceso no dependa de
  // que cada dispositivo pueda descargar módulos dinámicos desde gstatic.
  const SDK = "/vendor/";
  let api = null;
  const ready = Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js")
  ]).then(async ([appSdk, authSdk]) => {
    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    auth.languageCode = "es";
    try { await authSdk.setPersistence(auth, authSdk.browserLocalPersistence); }
    catch (error) {
      if (!/web-storage-unsupported|operation-not-supported-in-this-environment/.test(String(error.code || ''))) throw error;
      await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    }
    await auth.authStateReady();
    api = { app, auth, ...authSdk };
    return api;
  });

  function cleanUser(user) {
    return user ? {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: user.emailVerified === true,
      provider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || "password"
    } : null;
  }

  function message(error) {
    const code = String(error && error.code || "");
    if (code.includes("email-already-in-use")) return "Ese correo ya está registrado. Entra con tu contraseña o con Google.";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Correo o contraseña incorrectos.";
    if (code.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
    if (code.includes("popup-closed")) return "Se cerró la ventana de Google antes de terminar.";
    if (code.includes("popup-blocked")) return "El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo otra vez.";
    if (code.includes("network-request-failed")) return "No se pudo conectar al servicio de acceso. Revisa tu internet e inténtalo nuevamente.";
    if (code.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos e inténtalo nuevamente.";
    if (code.includes("internal-error")) return "No se pudo completar el acceso. Inténtalo nuevamente. Si estabas usando Google y continúa, entra con tu correo.";
    if (code.includes("unauthorized-domain") || code.includes("operation-not-allowed") || code.includes("configuration-not-found")) return "Este método de acceso no está disponible. Usa tu correo y avisa al restaurante.";
    if (code.includes("account-exists-with-different-credential")) return "Este correo ya tiene otro método de acceso. Entra con el método que usaste al registrarte.";
    if (code.includes("user-disabled")) return "La cuenta está desactivada. Contacta al restaurante.";
    if (code.includes("invalid-email")) return "Revisa que el correo esté escrito correctamente.";
    if (code) return "No se pudo completar el acceso. Inténtalo nuevamente.";
    const text = (error && error.message) || "No se pudo completar el acceso.";
    return /firebase|fiberbase|auth\/|https?:|imported module/i.test(text) ? "No se pudo cargar el acceso. Revisa tu conexión y vuelve a abrir la aplicación." : text;
  }

  window.AuthBridge = {
    ready,
    message,
    async createEmail(email, password, actionUrl) {
      const x = await ready;
      const credential = await x.createUserWithEmailAndPassword(x.auth, email, password);
      try {
        await x.sendEmailVerification(credential.user, { url: actionUrl || location.origin + '/?verified=1' });
      } catch (error) {
        try { await x.deleteUser(credential.user); } catch {}
        throw error;
      }
      return cleanUser(credential.user);
    },
    async signInEmail(email, password) {
      const x = await ready;
      const credential = await x.signInWithEmailAndPassword(x.auth, email, password);
      await credential.user.reload();
      return cleanUser(credential.user);
    },
    async signInGoogle() {
      // Avoid delaying the popup after the user's tap when initialization is done.
      const x = api || await ready;
      const provider = new x.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await x.signInWithPopup(x.auth, provider);
      return cleanUser(credential.user);
    },
    async signInToken(token) {
      const x = await ready;
      const credential = await x.signInWithCustomToken(x.auth, token);
      return cleanUser(credential.user);
    },
    async idToken() {
      const x = await ready;
      return x.auth.currentUser ? x.auth.currentUser.getIdToken() : "";
    },
    async resendVerification(actionUrl) {
      const x = await ready;
      if (!x.auth.currentUser) throw new Error("No hay una cuenta activa.");
      await x.sendEmailVerification(x.auth.currentUser, { url: actionUrl || location.origin + '/?verified=1' });
      return true;
    },
    async resetPassword(email) {
      const x = await ready;
      await x.sendPasswordResetEmail(x.auth, email, { url: location.origin + '/' });
      return true;
    },
    async messagingToken(registration, vapidKey) {
      const x=await ready;
      const messagingSdk=await import(SDK+"firebase-messaging.js");
      if(!(await messagingSdk.isSupported())) throw new Error("Este navegador no admite notificaciones push.");
      return messagingSdk.getToken(messagingSdk.getMessaging(x.app),{vapidKey,serviceWorkerRegistration:registration});
    },
    async current() {
      const x = await ready;
      if (!x.auth.currentUser) return null;
      await x.auth.currentUser.reload();
      return cleanUser(x.auth.currentUser);
    },
    async deleteCurrent() {
      const x = await ready;
      if (x.auth.currentUser) await x.deleteUser(x.auth.currentUser);
    },
    async signOut() {
      const x = await ready;
      await x.signOut(x.auth);
    }
  };
})();
