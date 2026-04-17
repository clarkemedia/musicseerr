import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNavidromeSupport1781000000000 implements MigrationInterface {
  name = 'AddNavidromeSupport1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "navidromeUserId" varchar NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "navidromeUsername" varchar NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN directly; no-op for down migration
  }
}
