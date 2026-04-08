import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMusicSupport1780000000000 implements MigrationInterface {
  name = 'AddMusicSupport1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add musicBrainzId to media table
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "musicBrainzId" character varying NULL`
    );

    // Add music-specific columns to media_request table
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "musicBrainzId" character varying NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "artistMusicBrainzId" character varying NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "artistName" character varying NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "albumTitle" character varying NULL`
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
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_media_musicBrainzId"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "metadataProfileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "albumTitle"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "artistName"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "artistMusicBrainzId"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "musicBrainzId"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "musicBrainzId"`
    );
  }
}
