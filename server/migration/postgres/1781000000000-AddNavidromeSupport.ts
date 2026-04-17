import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNavidromeSupport1781000000000 implements MigrationInterface {
  name = 'AddNavidromeSupport1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "navidromeUserId" character varying NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "navidromeUsername" character varying NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "navidromeUsername"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "navidromeUserId"`
    );
  }
}
