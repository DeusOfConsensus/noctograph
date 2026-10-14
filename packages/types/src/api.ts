/**
 * Noctograph — API Response Types
 *
 * All API responses are wrapped in this envelope for consistent error handling
 * and pagination across the frontend.
 */

/** Standard success envelope */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    /** Total count for paginated endpoints */
    total?: number;
    page?: number;
    limit?: number;
    hasNextPage?: boolean;
  };
}

/** Standard error envelope */
export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR"
  | "CHAIN_NOT_SUPPORTED"
  | "RATE_LIMITED"
  | "INDEXER_NOT_SYNCED";

/** Pagination query params */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Block as returned by the API (serializable — bigints become strings) */
export interface ApiBlock {
  hash: string;
  parentHash: string;
  number: string; // bigint serialized as string
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas: string | null;
  size: string;
  transactionCount: number;
  chainSlug: string;
  isOrphaned: boolean;
}

/** Transaction as returned by the API */
export interface ApiTransaction {
  hash: string;
  blockHash: string;
  blockNumber: string;
  transactionIndex: number;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasUsed: string;
  gasPrice: string;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  fee: string;
  input: string;
  nonce: number;
  type: number;
  status: 0 | 1;
  contractAddress: string | null;
  timestamp: number;
  chainSlug: string;
}

/** Address summary as returned by the API */
export interface ApiAddress {
  address: string;
  chainSlug: string;
  balance: string;
  transactionCount: number;
  isContract: boolean;
  contractName: string | null;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
}
