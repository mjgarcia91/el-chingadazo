// In-memory test configuration only; each test runs in its own Node process.
module.exports = async function configureInstance(projectId = 'chingadazo-test') {
  const { instance } = await import('../../server/instance.js');
  Object.assign(instance, { configured: true, publicOrigin: 'https://el-chingadazo.invalid' });
  Object.assign(instance.firebase, {
    projectId, apiKey:'test-key', authDomain:projectId+'.firebaseapp.com',
    databaseURL:'https://'+projectId+'-default-rtdb.firebaseio.com', appId:'test-app'
  });
  return instance;
};
