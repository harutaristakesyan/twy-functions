import { LoadStatus } from '@libs/db';
import { MessageResponse } from '@contracts/common/response';

export interface LoadLocationResponse {
  cityZipCode: string;
  phone: string;
  carrier: string;
  name: string;
  address: string;
}

export interface LoadResponse {
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
  pickup: LoadLocationResponse;
  dropoff: LoadLocationResponse;
  branchId: string;
  status: LoadStatus;
  files: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateLoadResponse extends MessageResponse {
  loadId: string;
}

export interface ChangeLoadStatusResponse extends MessageResponse {
  loadId: string;
  status: LoadStatus;
}

export interface LoadDetailsResponse {
  load: LoadResponse;
}
