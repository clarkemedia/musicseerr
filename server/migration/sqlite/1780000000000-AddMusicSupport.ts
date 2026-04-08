import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMusicSupport1780000000000 implements MigrationInterface {
  name = 'AddMusicSupport1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add musicBrainzId to media table
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "musicBrainzId" varchar NULL`
    );

    // Add music-specific columns to media_request table
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "musicBrainzId" varchar NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "artistMusicBrainzId" varchar NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "artistName" varchar NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "albumTitle" varchar NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "metadataProfileId" integer NULL`
    );

    // Add index on musicBrainzId for media table
    await queryRunner.query(
      `CREATE INDEX "IDX_media_musicBrainzId" ON "media" ("musicBrainzId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN, so we'd need table recreation
    // For simplicity, just drop the index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_media_musicBrainzId"`);
  }
}
