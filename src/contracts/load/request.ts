import { AuthContext } from '@contracts/common/auth';
import { loadStatusValues } from '@libs/db';
import z from 'zod';

const loadStatusEnum = z.enum(
  [...loadStatusValues] as [
    (typeof loadStatusValues)[number],
    ...(typeof loadStatusValues)[number][],
  ],
);

const uuidField = z.string().uuid('Value must be a valid UUID');

const locationSchema = z.object({
  cityZipCode: z.string().trim().min(1, 'City / Zipcode is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  carrier: z.string().trim().min(1, 'Carrier is required'),
  name: z.string().trim().min(1, 'Name is required'),
  address: z.string().trim().min(1, 'Address is required'),
});

const LoadBaseSchema = z.object({
  customerId: uuidField.describe('Customer'),
  referenceNumber: z.string().trim().min(1, 'Reference Number is required'),
  customerRate: z
    .number()
    .nonnegative('Customer Rate cannot be negative')
    .nullable()
    .optional(),
  contactName: z.string().trim().min(1, 'Contact Name is required'),
  carrier: z.string().trim().min(1, 'Carrier is required'),
  carrierPaymentMethod: z.string().trim().min(1).nullable().optional(),
  carrierRate: z.number().nonnegative('Carrier Rate cannot be negative'),
  chargeServiceFeeToOffice: z.boolean().optional(),
  loadType: z.string().trim().min(1, 'Load Type is required'),
  serviceType: z.string().trim().min(1, 'Service Type is required'),
  serviceGivenAs: z.string().trim().min(1, 'Service Given As is required'),
  commodity: z.string().trim().min(1, 'Commodity is required'),
  bookedAs: z.string().trim().min(1, 'Booked As is required'),
  soldAs: z.string().trim().min(1, 'Sold As is required'),
  weight: z.string().trim().min(1, 'Weight is required'),
  temperature: z.string().trim().nullable().optional(),
  pickup: locationSchema,
  dropoff: locationSchema,
  branchId: uuidField.describe('Branch'),
  status: loadStatusEnum.optional(),
  files: z
    .array(
      z.object({
        id: uuidField,
        fileName: z.string().trim().min(1, 'File name is required'),
      }),
    )
    .optional(),
});

export const CreateLoadEventSchema = z.object({
  requestContext: AuthContext,
  body: LoadBaseSchema,
});

export type CreateLoadEvent = z.infer<typeof CreateLoadEventSchema>;

export const loadSortFieldMap = {
  referenceNumber: 'referenceNumber',
  status: 'status',
  createdAt: 'createdAt',
  customerId: 'customerId',
} as const;

export const loadSortOrderMap = {
  ascend: 'asc',
  descend: 'desc',
} as const;

export const ListLoadsEventSchema = z.object({
  requestContext: AuthContext,
  queryStringParameters: z.object({
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default(0)
      .transform((val) => (isNaN(val) ? 0 : val)),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default(10)
      .transform((val) => (isNaN(val) ? 10 : val)),
    sortField: z
      .enum(Object.keys(loadSortFieldMap) as [keyof typeof loadSortFieldMap])
      .default('createdAt')
      .transform((val) => loadSortFieldMap[val as keyof typeof loadSortFieldMap]),
    sortOrder: z
      .enum(Object.keys(loadSortOrderMap) as [keyof typeof loadSortOrderMap])
      .default('descend')
      .transform((val) => loadSortOrderMap[val as keyof typeof loadSortOrderMap]),
    query: z.string().optional(),
  }),
});

export type ListLoadsEvent = z.infer<typeof ListLoadsEventSchema>;

const UpdateLoadPayloadSchema = LoadBaseSchema.partial()
  .extend({
    pickup: locationSchema.partial().optional(),
    dropoff: locationSchema.partial().optional(),
  })
  .superRefine((data, ctx) => {
    const hasAnyField = Object.entries(data).some(([, value]) => typeof value !== 'undefined');

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required to update the load',
        path: [],
      });
    }
  });

export const UpdateLoadEventSchema = z.object({
  requestContext: AuthContext,
  pathParameters: z.object({
    loadId: uuidField,
  }),
  body: UpdateLoadPayloadSchema,
});

export type UpdateLoadEvent = z.infer<typeof UpdateLoadEventSchema>;

export const ChangeLoadStatusEventSchema = z.object({
  requestContext: AuthContext,
  pathParameters: z.object({
    loadId: uuidField,
  }),
  body: z.object({
    status: loadStatusEnum,
  }),
});

export type ChangeLoadStatusEvent = z.infer<typeof ChangeLoadStatusEventSchema>;

export const DeleteLoadEventSchema = z.object({
  requestContext: AuthContext,
  pathParameters: z.object({
    loadId: uuidField,
  }),
});

export type DeleteLoadEvent = z.infer<typeof DeleteLoadEventSchema>;
