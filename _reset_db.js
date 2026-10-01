const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'CPvfEoCbc8reZrH.root',
    password: 'L51al1lhbIwFYLBZ',
    database: 'test',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true,
  });
  const order = [
    'sale_items',
    'sales',
    'stock_tx',
    'purchase_items',
    'purchase_orders',
    'product_uoms',
    'products',
    'categories',
    'uoms',
    'suppliers',
    'audit_logs',
    'users',
  ];
  for (const t of order) {
    await conn.query(`DROP TABLE IF EXISTS \`${t}\` CASCADE`);
    console.log('Dropped', t);
  }
  await conn.end();
})();
