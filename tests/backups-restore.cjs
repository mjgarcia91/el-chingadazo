const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
(async () => {
  const { createSnapshot } = await import('../server/backups.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chingadazo-backup-test-'));
  const file = path.join(directory, 'synthetic.json');
  try {
    const snapshot = await createSnapshot({ orders: { demo: { total: 125 } }, users: { demo: { name: 'Synthetic' } } });
    fs.writeFileSync(file, JSON.stringify(snapshot));
    let result = cp.spawnSync(process.execPath, ['scripts/verify-backup.mjs', file], {encoding:'utf8'});
    assert.equal(result.status,0);
    assert.equal(JSON.parse(result.stdout).counts.orders,1);
    assert(!result.stdout.includes('Synthetic'));
    snapshot.data.orders.demo.total++;
    fs.writeFileSync(file, JSON.stringify(snapshot));
    result = cp.spawnSync(process.execPath, ['scripts/verify-backup.mjs', file], {encoding:'utf8'});
    assert.equal(result.status,1);
    console.log('PASS offline verification: valid synthetic restore, corruption rejected, no sensitive output.');
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
})().catch(error => { console.error(error); process.exitCode=1; });
