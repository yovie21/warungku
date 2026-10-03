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
    `CREATE TABLE IF NOT EXISTS cash_reconciles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      biz_date DATE NOT NULL,
      expected DECIMAL(12,2) NOT NULL,
      counted DECIMAL(12,2) NOT NULL,
      diff DECIMAL(12,2) NOT NULL,
      note VARCHAR(200) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX cash_reconciles_biz_date (biz_date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
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