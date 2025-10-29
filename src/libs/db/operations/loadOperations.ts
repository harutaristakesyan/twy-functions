import { randomUUID } from 'node:crypto';
import createError from 'http-errors';
import {
  Database,
  LoadStatus,
  LoadTable,
  getDb,
  loadStatusValues,
} from '@libs/db';
import { Kysely, Selectable, Transaction } from 'kysely';

const LOAD_TABLE = 'load';
const LOAD_FILES_TABLE = 'load_files';
const FILE_TABLE = 'file';
const BRANCH_TABLE = 'branch';

const DEFAULT_LOAD_STATUS: LoadStatus = loadStatusValues[0];

type Executor = Kysely<Database> | Transaction<Database>;

type LoadRow = Selectable<LoadTable>;

type LoadFilesRow = { fileId: string };

export interface LoadFileInput {
  id: string;
  fileName?: string;
}

export interface LoadLocationRecord {
  cityZipCode: string;
  phone: string;
  carrier: string;
  name: string;
  address: string;
}

export interface LoadRecord {
  id: string;
  customerId: string;
  referenceNumber: string;
  customerRate: number | null;
  contactName: string;
  carrier: string;
  carrierPaymentMethod: string | null;
  carrierRate: number;
  chargeServiceFeeToOffice: boolean;
  loadType: string;
  serviceType: string;
  serviceGivenAs: string;
  commodity: string;
  bookedAs: string;
  soldAs: string;
  weight: string;
  temperature: string | null;
  pickup: LoadLocationRecord;
  dropoff: LoadLocationRecord;
  branchId: string;
  status: LoadStatus;
  files: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateLoadInput {
  customerId: string;
  referenceNumber: string;
  customerRate?: number | null;
  contactName: string;
  carrier: string;
  carrierPaymentMethod?: string | null;
  carrierRate: number;
  chargeServiceFeeToOffice?: boolean;
  loadType: string;
  serviceType: string;
  serviceGivenAs: string;
  commodity: string;
  bookedAs: string;
  soldAs: string;
  weight: string;
  temperature?: string | null;
  pickupCityZipCode: string;
  pickupPhone: string;
  pickupCarrier: string;
  pickupName: string;
  pickupAddress: string;
  dropoffCityZipCode: string;
  dropoffPhone: string;
  dropoffCarrier: string;
  dropoffName: string;
  dropoffAddress: string;
  branchId: string;
  status?: LoadStatus;
  files?: LoadFileInput[];
}

export interface UpdateLoadInput {
  customerId?: string;
  referenceNumber?: string;
  customerRate?: number | null;
  contactName?: string;
  carrier?: string;
  carrierPaymentMethod?: string | null;
  carrierRate?: number;
  chargeServiceFeeToOffice?: boolean;
  loadType?: string;
  serviceType?: string;
  serviceGivenAs?: string;
  commodity?: string;
  bookedAs?: string;
  soldAs?: string;
  weight?: string;
  temperature?: string | null;
  pickupCityZipCode?: string;
  pickupPhone?: string;
  pickupCarrier?: string;
  pickupName?: string;
  pickupAddress?: string;
  dropoffCityZipCode?: string;
  dropoffPhone?: string;
  dropoffCarrier?: string;
  dropoffName?: string;
  dropoffAddress?: string;
  branchId?: string;
  files?: LoadFileInput[];
}

const normalizeLoadFiles = (files: LoadFileInput[]): LoadFileInput[] => {
  const seen = new Map<string, LoadFileInput>();
  const ordered: LoadFileInput[] = [];

  for (const file of files) {
    const existing = seen.get(file.id);

    if (!existing) {
      const normalized: LoadFileInput = {
        id: file.id,
        fileName: file.fileName,
      };

      seen.set(file.id, normalized);
      ordered.push(normalized);
    } else if (!existing.fileName && file.fileName) {
      existing.fileName = file.fileName;
    }
  }

  return ordered;
};

const ensureBranchExists = async (db: Executor, branchId: string): Promise<void> => {
  const branch = await db
    .selectFrom(BRANCH_TABLE)
    .select(['id'])
    .where('id', '=', branchId)
    .executeTakeFirst();

  if (!branch) {
    throw new createError.NotFound('Branch not found');
  }
};

const ensureFilesPersisted = async (db: Executor, files: LoadFileInput[]): Promise<string[]> => {
  const uniqueFiles = normalizeLoadFiles(files);

  if (uniqueFiles.length === 0) {
    return [];
  }

  const fileIds = uniqueFiles.map((file) => file.id);

  const existing = await db
    .selectFrom(FILE_TABLE)
    .select(['id'])
    .where('id', 'in', fileIds)
    .execute();

  const existingIds = new Set(existing.map((file) => file.id));

  const missing = uniqueFiles.filter((file) => !existingIds.has(file.id));

  if (missing.length > 0) {
    const missingWithoutNames = missing.filter((file) => !file.fileName);

    if (missingWithoutNames.length > 0) {
      throw new createError.BadRequest(
        `File name is required for new files: ${missingWithoutNames.map((file) => file.id).join(', ')}`,
      );
    }

    const now = new Date();

    await db
      .insertInto(FILE_TABLE)
      .values(
        missing.map((file) => ({
          id: file.id,
          fileName: file.fileName!,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .execute();
  }

  return fileIds;
};

const fetchLoadFiles = async (db: Executor, loadId: string): Promise<string[]> => {
  const rows = await db
    .selectFrom(LOAD_FILES_TABLE)
    .select(['fileId'])
    .where('loadId', '=', loadId)
    .execute();

  return rows.map((row: LoadFilesRow) => row.fileId);
};

const mapLoadRow = (row: LoadRow, files: string[]): LoadRecord => ({
  id: row.id,
  customerId: row.customerId,
  referenceNumber: row.referenceNumber,
  customerRate: row.customerRate ?? null,
  contactName: row.contactName,
  carrier: row.carrier,
  carrierPaymentMethod: row.carrierPaymentMethod ?? null,
  carrierRate: row.carrierRate,
  chargeServiceFeeToOffice: Boolean(row.chargeServiceFeeToOffice),
  loadType: row.loadType,
  serviceType: row.serviceType,
  serviceGivenAs: row.serviceGivenAs,
  commodity: row.commodity,
  bookedAs: row.bookedAs,
  soldAs: row.soldAs,
  weight: row.weight,
  temperature: row.temperature ?? null,
  pickup: {
    cityZipCode: row.pickupCityZipCode,
    phone: row.pickupPhone,
    carrier: row.pickupCarrier,
    name: row.pickupName,
    address: row.pickupAddress,
  },
  dropoff: {
    cityZipCode: row.dropoffCityZipCode,
    phone: row.dropoffPhone,
    carrier: row.dropoffCarrier,
    name: row.dropoffName,
    address: row.dropoffAddress,
  },
  branchId: row.branchId,
  status: row.status,
  files,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
});

const replaceLoadFiles = async (db: Executor, loadId: string, fileIds: string[]): Promise<void> => {
  await db.deleteFrom(LOAD_FILES_TABLE).where('loadId', '=', loadId).execute();

  if (fileIds.length === 0) {
    return;
  }

  const values = fileIds.map((fileId) => ({ loadId, fileId }));

  await db.insertInto(LOAD_FILES_TABLE).values(values).execute();
};

export const getLoadById = async (loadId: string): Promise<LoadRecord | null> => {
  const db = await getDb();

  const load = await db.selectFrom(LOAD_TABLE).selectAll().where('id', '=', loadId).executeTakeFirst();

  if (!load) {
    return null;
  }

  const files = await fetchLoadFiles(db, loadId);

  return mapLoadRow(load as LoadRow, files);
};

export const createLoad = async (input: CreateLoadInput): Promise<string> => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    await ensureBranchExists(trx, input.branchId);

    const fileIds = input.files ? await ensureFilesPersisted(trx, input.files) : [];

    const loadId = randomUUID();

    await trx
      .insertInto(LOAD_TABLE)
      .values({
        id: loadId,
        customerId: input.customerId,
        referenceNumber: input.referenceNumber,
        customerRate: typeof input.customerRate === 'undefined' ? null : input.customerRate,
        contactName: input.contactName,
        carrier: input.carrier,
        carrierPaymentMethod:
          typeof input.carrierPaymentMethod === 'undefined' ? null : input.carrierPaymentMethod,
        carrierRate: input.carrierRate,
        chargeServiceFeeToOffice: Boolean(input.chargeServiceFeeToOffice),
        loadType: input.loadType,
        serviceType: input.serviceType,
        serviceGivenAs: input.serviceGivenAs,
        commodity: input.commodity,
        bookedAs: input.bookedAs,
        soldAs: input.soldAs,
        weight: input.weight,
        temperature: typeof input.temperature === 'undefined' ? null : input.temperature,
        pickupCityZipCode: input.pickupCityZipCode,
        pickupPhone: input.pickupPhone,
        pickupCarrier: input.pickupCarrier,
        pickupName: input.pickupName,
        pickupAddress: input.pickupAddress,
        dropoffCityZipCode: input.dropoffCityZipCode,
        dropoffPhone: input.dropoffPhone,
        dropoffCarrier: input.dropoffCarrier,
        dropoffName: input.dropoffName,
        dropoffAddress: input.dropoffAddress,
        branchId: input.branchId,
        status: input.status ?? DEFAULT_LOAD_STATUS,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    if (fileIds.length > 0) {
      await trx.insertInto(LOAD_FILES_TABLE).values(fileIds.map((fileId) => ({ loadId, fileId }))).execute();
    }

    return loadId;
  });
};

export const updateLoad = async (loadId: string, input: UpdateLoadInput): Promise<boolean> => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom(LOAD_TABLE)
      .select(['id'])
      .where('id', '=', loadId)
      .executeTakeFirst();

    if (!existing) {
      return false;
    }

    if (typeof input.branchId !== 'undefined') {
      await ensureBranchExists(trx, input.branchId);
    }

    let normalizedFiles: string[] | undefined;
    if (typeof input.files !== 'undefined') {
      normalizedFiles = input.files ? await ensureFilesPersisted(trx, input.files) : [];
    }

    const updatePayload: Record<string, unknown> = {};

    if (typeof input.customerId !== 'undefined') {
      updatePayload.customerId = input.customerId;
    }

    if (typeof input.referenceNumber !== 'undefined') {
      updatePayload.referenceNumber = input.referenceNumber;
    }

    if (typeof input.customerRate !== 'undefined') {
      updatePayload.customerRate = input.customerRate ?? null;
    }

    if (typeof input.contactName !== 'undefined') {
      updatePayload.contactName = input.contactName;
    }

    if (typeof input.carrier !== 'undefined') {
      updatePayload.carrier = input.carrier;
    }

    if (typeof input.carrierPaymentMethod !== 'undefined') {
      updatePayload.carrierPaymentMethod = input.carrierPaymentMethod ?? null;
    }

    if (typeof input.carrierRate !== 'undefined') {
      updatePayload.carrierRate = input.carrierRate;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'chargeServiceFeeToOffice')) {
      updatePayload.chargeServiceFeeToOffice = Boolean(input.chargeServiceFeeToOffice);
    }

    if (typeof input.loadType !== 'undefined') {
      updatePayload.loadType = input.loadType;
    }

    if (typeof input.serviceType !== 'undefined') {
      updatePayload.serviceType = input.serviceType;
    }

    if (typeof input.serviceGivenAs !== 'undefined') {
      updatePayload.serviceGivenAs = input.serviceGivenAs;
    }

    if (typeof input.commodity !== 'undefined') {
      updatePayload.commodity = input.commodity;
    }

    if (typeof input.bookedAs !== 'undefined') {
      updatePayload.bookedAs = input.bookedAs;
    }

    if (typeof input.soldAs !== 'undefined') {
      updatePayload.soldAs = input.soldAs;
    }

    if (typeof input.weight !== 'undefined') {
      updatePayload.weight = input.weight;
    }

    if (typeof input.temperature !== 'undefined') {
      updatePayload.temperature = input.temperature ?? null;
    }

    if (typeof input.pickupCityZipCode !== 'undefined') {
      updatePayload.pickupCityZipCode = input.pickupCityZipCode;
    }

    if (typeof input.pickupPhone !== 'undefined') {
      updatePayload.pickupPhone = input.pickupPhone;
    }

    if (typeof input.pickupCarrier !== 'undefined') {
      updatePayload.pickupCarrier = input.pickupCarrier;
    }

    if (typeof input.pickupName !== 'undefined') {
      updatePayload.pickupName = input.pickupName;
    }

    if (typeof input.pickupAddress !== 'undefined') {
      updatePayload.pickupAddress = input.pickupAddress;
    }

    if (typeof input.dropoffCityZipCode !== 'undefined') {
      updatePayload.dropoffCityZipCode = input.dropoffCityZipCode;
    }

    if (typeof input.dropoffPhone !== 'undefined') {
      updatePayload.dropoffPhone = input.dropoffPhone;
    }

    if (typeof input.dropoffCarrier !== 'undefined') {
      updatePayload.dropoffCarrier = input.dropoffCarrier;
    }

    if (typeof input.dropoffName !== 'undefined') {
      updatePayload.dropoffName = input.dropoffName;
    }

    if (typeof input.dropoffAddress !== 'undefined') {
      updatePayload.dropoffAddress = input.dropoffAddress;
    }

    if (typeof input.branchId !== 'undefined') {
      updatePayload.branchId = input.branchId;
    }

    if (Object.keys(updatePayload).length > 0) {
      await trx
        .updateTable(LOAD_TABLE)
        .set({
          ...updatePayload,
          updatedAt: new Date(),
        })
        .where('id', '=', loadId)
        .execute();
    }

    if (typeof normalizedFiles !== 'undefined') {
      await replaceLoadFiles(trx, loadId, normalizedFiles);
    }

    return true;
  });
};

export const changeLoadStatus = async (loadId: string, status: LoadStatus): Promise<boolean> => {
  const db = await getDb();

  const result = await db
    .updateTable(LOAD_TABLE)
    .set({ status, updatedAt: new Date() })
    .where('id', '=', loadId)
    .executeTakeFirst();

  return (result?.numUpdatedRows ?? 0n) > 0n;
};

export const deleteLoad = async (loadId: string): Promise<boolean> => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom(LOAD_TABLE)
      .select(['id'])
      .where('id', '=', loadId)
      .executeTakeFirst();

    if (!existing) {
      return false;
    }

    await trx.deleteFrom(LOAD_FILES_TABLE).where('loadId', '=', loadId).execute();

    await trx.deleteFrom(LOAD_TABLE).where('id', '=', loadId).execute();

    return true;
  });
};
