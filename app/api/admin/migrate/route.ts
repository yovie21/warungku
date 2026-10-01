import { prisma } from "@/lib/prisma";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function POST() {
  const results: string[] = [];
  const tasks = [
    `CREATE TABLE IF NOT EXISTS product_uoms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      uom_id INT NOT NULL,
      conversion_factor INT NOT NULL DEFAULT 1,
      price DECIMAL(12,2) NOT NULL,
      UNIQUE KEY uq_product_uom (product_id, uom_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (uom_id) REFERENCES uoms(id)
    )`,
    `ALTER TABLE sales ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'tunai'`,
    `ALTER TABLE sales ADD COLUMN invoice_no VARCHAR(24) NULL`,
    `ALTER TABLE sale_items ADD COLUMN uom_symbol VARCHAR(20) NULL`,
    `ALTER TABLE sale_items ADD COLUMN conversion_factor INT NOT NULL DEFAULT 1`,
    `ALTER TABLE sale_items ADD INDEX sale_items_sale_id (sale_id)`,
  ];
  for (const sql of tasks) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`OK: ${sql.substring(0, 60)}`);
    } catch (e: any) {
      results.push(`ERR: ${e.message?.substring(0, 100)}`);
    }
  }
  return json({ results });
}