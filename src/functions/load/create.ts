import { middyfy } from '@libs/lambda';
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { createLoad as createLoadRecord, LoadFileInput } from '@libs/db/operations/loadOperations';
import { CreateLoadEvent, CreateLoadEventSchema } from '@contracts/load/request';
import { CreateLoadResponse } from '@contracts/load/response';

const createLoad = async (event: CreateLoadEvent): Promise<CreateLoadResponse> => {
  const {
    customerId,
    referenceNumber,
    customerRate,
    contactName,
    carrier,
    carrierPaymentMethod,
    carrierRate,
    chargeServiceFeeToOffice,
    loadType,
    serviceType,
    serviceGivenAs,
    commodity,
    bookedAs,
    soldAs,
    weight,
    temperature,
    pickup,
    dropoff,
    branchId,
    status,
    files,
  } = event.body;

  const normalizedFiles: LoadFileInput[] | undefined = files?.map((file) => ({
    id: file.id,
    fileName: file.fileName,
  }));

  const loadId = await createLoadRecord({
    customerId,
    referenceNumber,
    customerRate,
    contactName,
    carrier,
    carrierPaymentMethod,
    carrierRate,
    chargeServiceFeeToOffice,
    loadType,
    serviceType,
    serviceGivenAs,
    commodity,
    bookedAs,
    soldAs,
    weight,
    temperature,
    pickupCityZipCode: pickup.cityZipCode,
    pickupPhone: pickup.phone,
    pickupCarrier: pickup.carrier,
    pickupName: pickup.name,
    pickupAddress: pickup.address,
    dropoffCityZipCode: dropoff.cityZipCode,
    dropoffPhone: dropoff.phone,
    dropoffCarrier: dropoff.carrier,
    dropoffName: dropoff.name,
    dropoffAddress: dropoff.address,
    branchId,
    status,
    files: normalizedFiles,
  });

  return {
    message: 'Load created successfully',
    loadId,
  };
};

export const handler = middyfy<
  CreateLoadEvent,
  CreateLoadResponse,
  APIGatewayProxyEventV2WithJWTAuthorizer
>(createLoad, {
  eventSchema: CreateLoadEventSchema,
  mode: 'parse',
});
