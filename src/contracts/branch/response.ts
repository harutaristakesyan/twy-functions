export interface BranchOwnerResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface BranchResponse {
  id: string;
  name: string;
  contact: string | null;
  owner: BranchOwnerResponse | null;
}

export type BranchListResponse = BranchResponse[];
