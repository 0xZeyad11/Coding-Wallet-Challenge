import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793436255842 implements MigrationInterface {
    name = 'InitialSchema1793436255842'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallet" ADD "date" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD CONSTRAINT "UQ_bea720b019edf7013b11cd32156" UNIQUE ("reference")`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "notes" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "wallet" ADD "notes" text array`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP CONSTRAINT "UQ_bea720b019edf7013b11cd32156"`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "date"`);
    }

}
